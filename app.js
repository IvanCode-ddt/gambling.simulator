// Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyAz6bab_GFDCMI6TQNpyJAySXruvZN7p5c",
  authDomain: "minibetting-30c79.firebaseapp.com",
  projectId: "minibetting-30c79",
  storageBucket: "minibetting-30c79.firebasestorage.app",
  messagingSenderId: "628216149749",
  appId: "1:628216149749:web:c029143fbb24dbe4bf77bc",
  measurementId: "G-CB3GKJX189"
};

// Init Firebase
const app = firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// Đăng ký
document.getElementById('btnRegister')?.addEventListener('click', async () => {
  const email = document.getElementById('regEmail').value;
  const pass = document.getElementById('regPass').value;
  if (!email || !pass) return alert('Nhập đầy đủ email và mật khẩu');

  try {
    const userCredential = await auth.createUserWithEmailAndPassword(email, pass);
    const user = userCredential.user;
    await db.collection('users').doc(user.uid).set({
      email: email,
      displayName: email,
      balance: 1000000
    });
    alert('Đăng ký thành công! Bạn được 1,000,000 VNĐ ảo.');
    window.location.href = 'matches.html';
  } catch(err) {
    alert(err.message);
  }
});

// Đăng nhập
document.getElementById('btnLogin')?.addEventListener('click', async () => {
  const email = document.getElementById('loginEmail').value;
  const pass = document.getElementById('loginPass').value;
  try {
    const userCredential = await auth.signInWithEmailAndPassword(email, pass);
    window.location.href = 'matches.html';
  } catch(err) {
    alert('Đăng nhập thất bại: ' + err.message);
  }
});

// Load matches cho người chơi
async function loadMatches() {
  const snapshot = await db.collection('matches').get();
  const container = document.getElementById('matchesList');
  if (!container) return;
  container.innerHTML = '';

  snapshot.forEach(doc => {
    const match = doc.data();
    const div = document.createElement('div');
    div.innerHTML = `
      <h3>${match.teamA} vs ${match.teamB}</h3>
      <p>Tỷ lệ: ${match.oddsA} - ${match.oddsDraw} - ${match.oddsB}</p>
      <input type="number" placeholder="Số tiền" id="betAmount_${doc.id}">
      <select id="betChoice_${doc.id}">
        <option value="A">${match.teamA}</option>
        <option value="Draw">Hòa</option>
        <option value="B">${match.teamB}</option>
      </select>
      <button onclick="placeBet('${doc.id}')">Đặt cược</button>
      <hr>
    `;
    container.appendChild(div);
  });
}

// Đặt cược
async function placeBet(matchId) {
  const amount = parseInt(document.getElementById(`betAmount_${matchId}`).value);
  const choice = document.getElementById(`betChoice_${matchId}`).value;
  const user = auth.currentUser;
  if (!user) return alert('Chưa đăng nhập!');
  const userRef = db.collection('users').doc(user.uid);
  const userDoc = await userRef.get();
  const balance = userDoc.data().balance;

  if (amount > balance) return alert('Số dư không đủ');

  await db.collection('bets').add({
    userId: user.uid,
    matchId: matchId,
    choice: choice,
    amount: amount,
    status: 'pending'
  });

  await userRef.update({ balance: balance - amount });
  alert('Đặt cược thành công!');
}

// Load matches cho admin
async function loadMatchesAdmin() {
  const snapshot = await db.collection('matches').get();
  const container = document.getElementById('adminMatchesList');
  if (!container) return;
  container.innerHTML = '';

  snapshot.forEach(doc => {
    const match = doc.data();
    const div = document.createElement('div');
    div.innerHTML = `
      <h3>${match.teamA} vs ${match.teamB}</h3>
      <select id="result_${doc.id}">
        <option value="A">${match.teamA}</option>
        <option value="Draw">Hòa</option>
        <option value="B">${match.teamB}</option>
      </select>
      <button onclick="resolveMatch('${doc.id}')">Cập nhật kết quả</button>
      <hr>
    `;
    container.appendChild(div);
  });
}

// Admin cập nhật kết quả
async function resolveMatch(matchId) {
  const resultChoice = document.getElementById(`result_${matchId}`).value;
  const matchRef = db.collection('matches').doc(matchId);
  await matchRef.update({ result: resultChoice });

  const betsSnapshot = await db.collection('bets').where('matchId', '==', matchId).get();
  betsSnapshot.forEach(async betDoc => {
    const bet = betDoc.data();
    const userRef = db.collection('users').doc(bet.userId);
    const userDoc = await userRef.get();
    let payout = 0;
    if (bet.choice === resultChoice) {
      const odds = 2.0;
      payout = bet.amount * odds;
      await userRef.update({ balance: userDoc.data().balance + payout });
      await betDoc.ref.update({ status: 'won', payout: payout });
    } else {
      await betDoc.ref.update({ status: 'lost', payout: 0 });
    }
  });

  alert('Kết quả đã được cập nhật!');
}
