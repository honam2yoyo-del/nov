import { auth, db } from './firebase.js';
import { GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { state } from './state.js';
import { showToast } from './ui.js';

export function initAuth(onApproved, onLogout) {
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            state.currentUser = user;
            const userDocRef  = doc(db, "approved_users", user.email);
            const userDocSnap = await getDoc(userDocRef);

            if (userDocSnap.exists() && userDocSnap.data().approved === true) {
                state.isApproved = true;
                document.getElementById('login-screen').style.display = 'none';
                document.getElementById('main-app').style.display = 'block';
                document.getElementById('user-info').innerText = user.email;

                // 저장된 탭을 데이터 로드 전에 즉시 적용 (깜빡임 방지)
                const _savedTab = localStorage.getItem('activeTab');
                if (_savedTab && document.getElementById(_savedTab)) {
                    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
                    document.querySelectorAll('.sidebar-btn').forEach(el => el.classList.remove('active'));
                    document.getElementById(_savedTab).classList.add('active');
                    document.querySelector(`.sidebar-btn[data-tab="${_savedTab}"]`)?.classList.add('active');
                }

                onApproved();
                showToast("환영합니다!", "success");
            } else {
                state.isApproved = false;
                document.getElementById('login-screen').style.display = 'flex';
                document.getElementById('main-app').style.display = 'none';
                document.querySelector('.google-btn').style.display = 'none';
                document.getElementById('approval-msg').style.display = 'block';
                if (!userDocSnap.exists()) {
                    await setDoc(userDocRef, {
                        approved: false,
                        email: user.email,
                        name: user.displayName,
                        requestedAt: new Date().toISOString()
                    });
                }
            }
        } else {
            state.currentUser = null;
            state.isApproved  = false;
            document.getElementById('login-screen').style.display = 'flex';
            document.getElementById('main-app').style.display = 'none';
            document.querySelector('.google-btn').style.display = 'flex';
            document.getElementById('approval-msg').style.display = 'none';
            onLogout();
        }
    });
}

export function loginWithGoogle() {
    const provider = new GoogleAuthProvider();
    signInWithPopup(auth, provider).catch(() => {
        showToast("로그인 중 오류가 발생했습니다.", "error");
    });
}

export function logout() {
    signOut(auth);
}

window.loginWithGoogle = loginWithGoogle;
window.logout          = logout;
