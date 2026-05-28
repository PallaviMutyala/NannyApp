import { createContext, useContext, useEffect, useState } from 'react'
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
} from 'firebase/auth'
import {
  doc, setDoc, getDoc, getDocs, updateDoc, writeBatch,
  collection, query, where, serverTimestamp,
} from 'firebase/firestore'
import { auth, db } from '../firebase/config'

const AuthContext = createContext()

export function useAuth() {
  return useContext(AuthContext)
}

function generateInviteCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

async function lookupFamilyByCode(code) {
  const snap = await getDocs(
    query(collection(db, 'families'), where('inviteCode', '==', code.toUpperCase().trim()))
  )
  if (snap.empty) return null
  return { id: snap.docs[0].id, ...snap.docs[0].data() }
}

async function backfillLogFamilyId(uid, familyId) {
  const logsSnap = await getDocs(query(collection(db, 'logs'), where('loggedBy', '==', uid)))
  const unmigrated = logsSnap.docs.filter(d => !d.data().familyId)
  if (unmigrated.length === 0) return
  const batch = writeBatch(db)
  unmigrated.forEach(d => batch.update(d.ref, { familyId }))
  await batch.commit()
}

async function migrateToFamily(uid, profile) {
  const familyRef = doc(collection(db, 'families'))
  await setDoc(familyRef, {
    inviteCode: generateInviteCode(),
    createdBy: uid,
    createdAt: serverTimestamp(),
  })
  await updateDoc(doc(db, 'users', uid), { familyId: familyRef.id })
  await backfillLogFamilyId(uid, familyRef.id)
  return { ...profile, familyId: familyRef.id }
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null)
  const [userProfile, setUserProfile] = useState(null)
  const [familyData, setFamilyData] = useState(null)
  const [loading, setLoading] = useState(true)

  async function signup(email, password, name, role, inviteCode) {
    const cred = await createUserWithEmailAndPassword(auth, email, password)
    await updateProfile(cred.user, { displayName: name })

    let familyId
    if (inviteCode) {
      const family = await lookupFamilyByCode(inviteCode)
      if (!family) throw new Error('Invalid invite code. Please check with your family.')
      familyId = family.id
    } else {
      const familyRef = doc(collection(db, 'families'))
      familyId = familyRef.id
      await setDoc(familyRef, {
        inviteCode: generateInviteCode(),
        createdBy: cred.user.uid,
        createdAt: serverTimestamp(),
      })
    }

    await setDoc(doc(db, 'users', cred.user.uid), {
      name, email, role, familyId,
      createdAt: serverTimestamp(),
    })
    return cred
  }

  function login(email, password) {
    return signInWithEmailAndPassword(auth, email, password)
  }

  function logout() {
    return signOut(auth)
  }

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user)
      if (user) {
        const snap = await getDoc(doc(db, 'users', user.uid))
        let profile = snap.exists() ? snap.data() : null

        if (profile && !profile.familyId) {
          profile = await migrateToFamily(user.uid, profile)
        } else if (profile?.familyId) {
          await backfillLogFamilyId(user.uid, profile.familyId)
        }

        setUserProfile(profile)

        if (profile?.familyId) {
          const fSnap = await getDoc(doc(db, 'families', profile.familyId))
          setFamilyData(fSnap.exists() ? fSnap.data() : null)
        }
      } else {
        setUserProfile(null)
        setFamilyData(null)
      }
      setLoading(false)
    })
    return unsub
  }, [])

  const value = { currentUser, userProfile, familyData, signup, login, logout }

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  )
}
