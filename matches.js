import { initializeApp } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-app.js";
import { getFirestore, collection, onSnapshot, addDoc, doc, getDoc, query, where, updateDoc, getDocs } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js";

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
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// DOM Elements
const userEmailEl = document.getElementById('userEmail');
const userBalanceEl = document.getElementById('userBalance');
const logoutBtn = document.getElementById('logoutBtn');
const ticketBtn = document.getElementById('ticketBtn');
const ticketModal = document.getElementById('ticketModal');
const ticketClose = document.getElementById('ticketClose');
const ticketTableBody = document.getElementById('ticketTableBody');
const matchContainer = document.getElementById('matchContainer');
const leaderboardBody = document.querySelector('#leaderboard tbody');

const matchesRef = collection(db,"matches");
const betsRef = collection(db,"bets");
const usersRef = collection(db,"users");

// Format number
const fmt = n => (typeof n==='number'? n.toLocaleString() : n);

// Hiển thị tên kèo
function translateBetKey(key, match) {
  switch(key){
    case 'winA': return `${match.teamA} thắng`;
    case 'draw': return 'Hòa';
    case 'winB': return `${match.teamB} thắng`;
    case 'over25': return 'Tài 2.5';
    case 'under25': return 'Xỉu 2.5';
    case 'cornerOver': return 'Tài góc';
    case 'cornerUnder': return 'Xỉu góc';
    case 'next15Yes': return 'Có rung';
    case 'next15No': return 'Không rung';
    default: return key;
  }
}

// --- Auth
onAuthStateChanged(auth, async (user)=>{
  if(!user){ window.location.href='index.html'; return; }

  // Lấy thông tin user từ Firestore
  const userRef = doc(db,'users',user.uid);
  onSnapshot(userRef, snap => {
      if(snap.exists()){
          const nickname = snap.data().nickname || snap.data().displayName || user.uid;
          userEmailEl.textContent = nickname;
          userBalanceEl.textContent = fmt(snap.data().balance || 0);
      }
  });

  loadMatches();
  loadLeaderboard();
});

// Logout
logoutBtn.onclick = ()=>signOut(auth);

// Vé cược popup
ticketBtn.onclick = ()=>{ ticketModal.style.display='flex'; loadMyTickets(); };
ticketClose.onclick = ()=>{ ticketModal.style.display='none'; };
window.onclick = (e)=>{ if(e.target===ticketModal) ticketModal.style.display='none'; };

// Load trận đang mở
function loadMatches(){
  onSnapshot(matchesRef,snapshot=>{
    matchContainer.innerHTML='';
    snapshot.forEach(docSnap=>{
      const m = docSnap.data();
      const id = docSnap.id;
      if(m.status!=='open' && m.status!=='locked') return;

      const group1 = ['winA','draw','winB'];
      const group2 = ['over25','under25'];
      const group3 = ['cornerOver','cornerUnder'];
      const group4 = ['next15Yes','next15No'];

      const card = document.createElement('div');
      card.className='match-card';
      card.innerHTML=`
        <strong>${m.teamA}</strong> vs <strong>${m.teamB}</strong><br>
        🕒 ${new Date(m.startTime).toLocaleString()}<br>
        Trạng thái: <b>${m.status}</b><br>
        <input type="number" id="bet-amount-${id}" placeholder="Số tiền" style="width:120px; margin-top:6px;"><br>

        <div class="odds-group">${group1.map(k=>`<button data-id="${id}" data-type="${k}" ${m.status!=='open'?'disabled':''}>${translateBetKey(k,m)}<br><b>${m.odds[k]}</b></button>`).join('')}</div>
        <div class="odds-group">${group2.map(k=>`<button data-id="${id}" data-type="${k}" ${m.status!=='open'?'disabled':''}>${translateBetKey(k,m)}<br><b>${m.odds[k]}</b></button>`).join('')}</div>
        <div class="odds-group">${group3.map(k=>`<button data-id="${id}" data-type="${k}" ${m.status!=='open'?'disabled':''}>${translateBetKey(k,m)}<br><b>${m.odds[k]}</b></button>`).join('')}</div>
        <div class="odds-group">${group4.map(k=>`<button data-id="${id}" data-type="${k}" ${m.status!=='open'?'disabled':''}>${translateBetKey(k,m)}<br><b>${m.odds[k]}</b></button>`).join('')}</div>

        <button class="confirm-bet-btn" data-id="${id}">✅ Xác nhận cược</button>
      `;
      matchContainer.appendChild(card);
    });

    attachBetHandlers();
    attachConfirmButtons();
  });
}

// Chọn kèo (chỉ được 1 kèo/trận) và hiển thị dự đoán
function attachBetHandlers(){
  document.querySelectorAll('.odds-group button').forEach(btn=>{
    btn.onclick = ()=>{
      const matchId = btn.dataset.id;
      document.querySelectorAll(`#matchContainer .match-card button[data-id="${matchId}"]`).forEach(b=>b.classList.remove('selected'));
      btn.classList.add('selected');

      const amountInput = document.getElementById(`bet-amount-${matchId}`);
      const amount = parseInt(amountInput.value);
      const matchSnap = btn.closest('.match-card');
      if(amount && amount>0){
        const oddsAtBet = parseFloat(btn.querySelector('b').textContent);
        const potential = amount * oddsAtBet;
        const profit = potential - amount;
        let infoEl = matchSnap.querySelector('.bet-info');
        if(!infoEl){
          infoEl = document.createElement('div');
          infoEl.className = 'bet-info';
          infoEl.style.marginTop = '6px';
          matchSnap.appendChild(infoEl);
        }
        infoEl.textContent = `💰 Dự đoán: Nhận ${potential.toLocaleString()} VNĐ (lời ${profit.toLocaleString()} VNĐ)`;
      } else {
        const infoEl = matchSnap.querySelector('.bet-info');
        if(infoEl) infoEl.remove();
      }
    };
  });
}

// Xác nhận cược
function attachConfirmButtons(){
  document.querySelectorAll('.confirm-bet-btn').forEach(btn=>{
    btn.onclick = async ()=>{
      const matchId = btn.dataset.id;
      const selectedButton = document.querySelector(`#matchContainer .match-card button.selected[data-id="${matchId}"]`);
      if(!selectedButton) return alert("Chọn 1 kèo.");

      const amountInput = document.getElementById(`bet-amount-${matchId}`);
      const amount = parseInt(amountInput.value);
      if(!amount || amount<=0) return alert("Nhập số tiền hợp lệ.");

      const user = auth.currentUser;
      if(!user) return alert("Bạn chưa đăng nhập.");

      const userRef = doc(db,'users',user.uid);
      const userSnap = await getDoc(userRef);
      const balance = (userSnap.exists() && userSnap.data().balance)?userSnap.data().balance:0;
      if(amount>balance) return alert("Số dư không đủ!");

      const matchSnap = await getDoc(doc(db,'matches',matchId));
      if(!matchSnap.exists()) return alert("Trận không tồn tại.");
      const match = matchSnap.data();
      if(match.status!=='open') return alert("Đã khóa cược.");

      const betType = selectedButton.dataset.type;
      const oddsAtBet = match.odds[betType]||1.0;
      await addDoc(betsRef,{
        userId: user.uid,
        matchId,
        betType,
        amount,
        odds: oddsAtBet,
        status:'pending',
        createdAt: new Date()
      });

      await updateDoc(userRef,{balance: balance-amount});
      amountInput.value='';
      selectedButton.classList.remove('selected');
      const infoEl = selectedButton.closest('.match-card').querySelector('.bet-info');
      if(infoEl) infoEl.remove();
      alert("✅ Đặt cược thành công!");
    };
  });
}

// Vé cược
async function loadMyTickets(){
  const user = auth.currentUser;
  if(!user) return;
  const q = query(betsRef, where('userId','==',user.uid));
  const snap = await getDocs(q);
  ticketTableBody.innerHTML='';
  for(const docSnap of snap.docs){
    const b = docSnap.data();
    const matchSnap = await getDoc(doc(db,'matches',b.matchId));
    const m = matchSnap.exists()?matchSnap.data():null;
    const matchName = m?`${m.teamA} 🆚 ${m.teamB}`:'Trận đã xóa';
    const statusText = b.status==='pending'?'⏳ Chờ':(b.status==='win'?'✅ Thắng':'❌ Thua');
    ticketTableBody.insertAdjacentHTML('beforeend',`
      <tr>
        <td>${matchName}</td>
        <td>${translateBetKey(b.betType,m||{})}</td>
        <td>${(b.amount||0).toLocaleString()} VNĐ</td>
        <td>${statusText}</td>
        <td>${b.payout?b.payout.toLocaleString()+' VNĐ':'-'}</td>
      </tr>
    `);
  }
}

// Leaderboard
function loadLeaderboard(){
  onSnapshot(usersRef, snap=>{
    const arr=[];
    snap.forEach(d=>arr.push(d.data()));
    arr.sort((a,b)=>(b.balance||0)-(a.balance||0));
    leaderboardBody.innerHTML = arr.map((u,i)=>`
      <tr>
        <td>${i+1}</td>
        <td>${u.nickname || u.displayName || u.uid}</td>
        <td>${(u.balance||0).toLocaleString()} VNĐ</td>
      </tr>
    `).join('');
  });
}
