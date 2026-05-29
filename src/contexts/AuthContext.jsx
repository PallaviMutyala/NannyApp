import { createContext, useContext, useEffect, useState } from 'react'
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
} from 'firebase/auth'
import {
  doc, setDoc, getDoc, updateDoc,
  collection, query, where, getDocs, serverTimestamp,
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

async function createFamilyFor(uid) {
  const familyRef = doc(collection(db, 'families'))
  await setDoc(familyRef, {
    inviteCode: generateInviteCode(),
    createdBy: uid,
    createdAt: serverTimestamp(),
  })
  return familyRef.id
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
      familyId = await createFamilyFor(cred.user.uid)
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

  async function setHourlyRate(rate) {
    await updateDoc(doc(db, 'families', userProfile.familyId), { hourlyRate: rate })
    setFamilyData(f => ({ ...f, hourlyRate: rate }))
  }

  // Switch the current user into an existing family by invite code.
  async function joinFamily(inviteCode) {
    const family = await lookupFamilyByCode(inviteCode)
    if (!family) throw new Error('Invalid invite code. Please check and try again.')
    if (family.id === userProfile?.familyId) throw new Error("You're already in this family.")
    await updateDoc(doc(db, 'users', currentUser.uid), { familyId: family.id })
    setUserProfile(p => ({ ...p, familyId: family.id }))
    setFamilyData({ inviteCode: family.inviteCode, createdBy: family.createdBy, createdAt: family.createdAt })
    return family
  }

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user)
      try {
        if (user) {
          const snap = await getDoc(doc(db, 'users', user.uid))
          let profile = snap.exists() ? snap.data() : null

          // Safety net: every user must belong to a family
          if (profile && !profile.familyId) {
            const familyId = await createFamilyFor(user.uid)
            await updateDoc(doc(db, 'users', user.uid), { familyId })
            profile = { ...profile, familyId }
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
      } catch (err) {
        console.error('Auth state error:', err)
      } finally {
        setLoading(false)
      }
    })
    return unsub
  }, [])

  const value = { currentUser, userProfile, familyData, signup, login, logout, joinFamily, setHourlyRate }

  return (
    <AuthContext.Provider value={value}>
      {loading ? <AuthLoading /> : children}
    </AuthContext.Provider>
  )
}

function AuthLoading() {
  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center gap-4 bg-violet-50">
      <div className="w-14 h-14 rounded-2xl bg-violet-600 flex items-center justify-center text-3xl">🍼</div>
      <div className="w-7 h-7 border-[3px] border-violet-200 border-t-violet-600 rounded-full animate-spin" />
    </div>
  )
}
