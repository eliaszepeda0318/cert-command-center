import type { User } from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from './firebase';

/** Creates users/{uid} on first paid sign-in. Only called once access is confirmed (rules reject writes from unpaid users). */
export async function ensureProfile(u: User) {
  const ref = doc(db, 'users', u.uid);
  if ((await getDoc(ref)).exists()) return;
  await setDoc(ref, {
    displayName: u.displayName, email: u.email, photoURL: u.photoURL,
    settings: { weeklyGoalMinutes: 300, activeCertificationId: 'ccna-200-301' },
    stats: { xp: 0, totalStudyMinutes: 0, ankiSessions: 0 },
    createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  });
}
