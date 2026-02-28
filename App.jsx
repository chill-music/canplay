import React, { useState, useEffect, useCallback } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, setDoc, onSnapshot, updateDoc, collection, getDoc } from 'firebase/firestore';
import { User, Shield, Sword, Flame, RotateCcw, Crown, Trash2 } from 'lucide-react';

// --- إعدادات Firebase الخاصة بك ---
const firebaseConfig = {
  apiKey: "AIzaSyA-EFkp60zFSL09uisR20lm1nVowC4udfo",
  authDomain: "gameon-f1ee4.firebaseapp.com",
  projectId: "gameon-f1ee4",
  storageBucket: "gameon-f1ee4.firebasestorage.app",
  messagingSenderId: "1059481077905",
  appId: "1:1059481077905:web:6845a33ce7327b87679730",
  measurementId: "G-PVKFJSEMJP"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'jackaroo-complex-v1';

// --- الثوابت الهندسية للترابيزة ---
const TOTAL_HOLES = 60; 
const PLAYER_COLORS = ['yellow', 'blue', 'red', 'green'];

export default function App() {
  const [user, setUser] = useState(null);
  const [gameState, setGameState] = useState(null);
  const [selectedCard, setSelectedCard] = useState(null);
  const [selectedMarble, setSelectedMarble] = useState(null);
  const [isBurning, setIsBurning] = useState(false);

  // 1. المصادقة التلقائية
  useEffect(() => {
    const initAuth = async () => {
      try {
        await signInAnonymously(auth);
      } catch (err) {
        console.error("Auth Error", err);
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  // 2. مزامنة حالة اللعبة في الوقت الفعلي
  useEffect(() => {
    if (!user) return;
    const gameRef = doc(db, 'artifacts', appId, 'public', 'data', 'current_game');
    
    const unsubscribe = onSnapshot(gameRef, (snapshot) => {
      if (snapshot.exists()) {
        setGameState(snapshot.data());
      } else {
        const initialData = {
          players: {
            yellow: { name: 'Player 1', marbles: [-1, -1, -1, -1], hand: ['K', 'Q', '7', '4'] },
            blue: { name: 'Player 2', marbles: [-1, -1, -1, -1], hand: ['A', '10', '5', '3'] },
            red: { name: 'Player 3', marbles: [-1, -1, -1, -1], hand: ['K', '8', '2', 'J'] },
            green: { name: 'Player 4', marbles: [-1, -1, -1, -1], hand: ['Q', '9', '6', 'A'] },
          },
          turn: 'yellow',
          graveyard: []
        };
        setDoc(gameRef, initialData);
      }
    }, (error) => console.error("Firestore Error:", error));

    return () => unsubscribe();
  }, [user]);

  // --- منطق الأوراق المعقدة (Complex Logic) ---

  const handleAction = async (type, data) => {
    if (!gameState || !user) return;
    const gameRef = doc(db, 'artifacts', appId, 'public', 'data', 'current_game');
    const updatedPlayers = { ...gameState.players };

    if (type === 'MOVE') {
      const { color, index, steps } = data;
      let currentPos = updatedPlayers[color].marbles[index];
      let targetPos;

      // قانون الـ 4 للخلف
      if (steps === -4) {
        targetPos = currentPos === -1 ? -1 : (currentPos - 4 + TOTAL_HOLES) % TOTAL_HOLES;
      } else {
        // خروج من البيت (القص أو الشايب)
        if (currentPos === -1 && (steps === 1 || steps === 13)) {
          targetPos = getStartPos(color);
        } else if (currentPos !== -1) {
          targetPos = (currentPos + steps) % TOTAL_HOLES;
        } else return; // لا يمكن التحرك
      }

      // منطق "الشايب البلدوزر" (قتل كل من في الطريق)
      if (steps === 13) {
        Object.keys(updatedPlayers).forEach(pCol => {
          updatedPlayers[pCol].marbles = updatedPlayers[pCol].marbles.map(mPos => {
            if (isBetween(currentPos, targetPos, mPos)) return -1;
            return mPos;
          });
        });
      }

      // القتل العادي (بما في ذلك قتل النفس)
      Object.keys(updatedPlayers).forEach(pCol => {
        updatedPlayers[pCol].marbles = updatedPlayers[pCol].marbles.map(mPos => {
          if (mPos === targetPos && targetPos !== -1) return -1;
          return mPos;
        });
      });

      updatedPlayers[color].marbles[index] = targetPos;
      await updateDoc(gameRef, { players: updatedPlayers, turn: getNextTurn(gameState.turn) });
    }

    if (type === 'BURN_QUEEN') {
      const { targetColor } = data;
      const targetHand = [...updatedPlayers[targetColor].hand];
      if (targetHand.length > 0) {
        const randomIndex = Math.floor(Math.random() * targetHand.length);
        const burnedCard = targetHand.splice(randomIndex, 1)[0];
        await updateDoc(gameRef, { 
          players: updatedPlayers, 
          graveyard: [burnedCard, ...gameState.graveyard].slice(0, 10) 
        });
        setIsBurning(false);
      }
    }

    setSelectedCard(null);
    setSelectedMarble(null);
  };

  if (!gameState) return <div className="h-screen bg-black flex items-center justify-center text-white">جاري الاتصال بـ Firebase...</div>;

  return (
    <div className="min-h-screen bg-[#1a1a1a] text-white flex flex-col items-center p-6 overflow-hidden">
      
      {/* عرض اللاعبين (توزيع 2 في الأعلى و 2 في الأسفل) */}
      <div className="w-full max-w-4xl flex justify-between mb-10">
        <PlayerUI color="yellow" data={gameState.players.yellow} isTurn={gameState.turn === 'yellow'} />
        <PlayerUI color="blue" data={gameState.players.blue} isTurn={gameState.turn === 'blue'} />
      </div>

      {/* ترابيزة الجاكارو - تصميم رخامي فاخر */}
      <div className="relative w-[550px] h-[550px] bg-[#e0e0e0] rounded-[60px] shadow-[0_20px_60px_rgba(0,0,0,0.8)] border-[15px] border-[#2c2c2c] flex items-center justify-center">
        
        {/* تصميم المسار الدائري */}
        <div className="absolute inset-0 p-8">
           {Array.from({length: TOTAL_HOLES}).map((_, i) => (
             <div key={i} className="absolute w-5 h-5 bg-black/10 rounded-full border border-black/5"
                  style={getHolePosition(i)} />
           ))}
        </div>

        {/* الأحجار */}
        {PLAYER_COLORS.map(color => 
          gameState.players[color].marbles.map((pos, i) => (
            <div 
              key={`${color}-${i}`}
              onClick={() => setSelectedMarble({color, index: i})}
              className={`absolute w-7 h-7 rounded-full cursor-pointer transition-all duration-500 shadow-lg border-2 
                ${selectedMarble?.color === color && selectedMarble?.index === i ? 'ring-4 ring-white scale-125 z-10' : 'border-black/20'}
                ${getMarbleBg(color)}`}
              style={getMarblePosition(pos, color, i)}
            />
          ))
        )}

        {/* مركز اللعبة */}
        <div className="text-center select-none">
          <h2 className="text-4xl font-serif font-black text-black/20">COMPLEX</h2>
          <div className="mt-2 flex gap-2 justify-center">
            {gameState.graveyard.slice(0, 3).map((c, i) => (
              <div key={i} className="w-8 h-12 bg-black/5 border border-black/10 rounded flex items-center justify-center text-black/30 font-bold">{c}</div>
            ))}
          </div>
        </div>
      </div>

      <div className="w-full max-w-4xl flex justify-between mt-10">
        <PlayerUI color="green" data={gameState.players.green} isTurn={gameState.turn === 'green'} />
        <PlayerUI color="red" data={gameState.players.red} isTurn={gameState.turn === 'red'} />
      </div>

      {/* لوحة التحكم بالكروت */}
      <div className="fixed bottom-6 flex gap-3">
        {gameState.players[gameState.turn].hand.map((card, i) => (
          <button 
            key={i}
            onClick={() => {
              setSelectedCard(card);
              if (card === 'Q') setIsBurning(true);
            }}
            className={`w-16 h-24 rounded-xl font-bold text-xl transition-all shadow-xl border-2
              ${selectedCard === card ? '-translate-y-6 bg-white text-black border-yellow-400' : 'bg-zinc-800 text-white border-zinc-700 hover:bg-zinc-700'}`}
          >
            {card}
          </button>
        ))}
        {selectedMarble && selectedCard && (
          <button 
            onClick={() => handleAction('MOVE', { color: selectedMarble.color, index: selectedMarble.index, steps: getSteps(selectedCard) })}
            className="ml-6 px-8 bg-yellow-500 text-black font-black rounded-xl hover:bg-yellow-400 shadow-lg uppercase tracking-wider"
          >
            تأكيد الحركة
          </button>
        )}
      </div>

      {/* مودال حرق البنت (اختيار العدو) */}
      {isBurning && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center z-[100]">
          <div className="bg-zinc-900 p-10 rounded-3xl border border-zinc-700 text-center max-w-md">
            <Sword className="mx-auto mb-4 text-red-500" size={48} />
            <h3 className="text-2xl font-black mb-6">اختر العدو لحرق كارت عشوائي من يده</h3>
            <div className="grid grid-cols-2 gap-4">
              {PLAYER_COLORS.filter(c => c !== gameState.turn).map(c => (
                <button key={c} onClick={() => handleAction('BURN_QUEEN', { targetColor: c })}
                        className={`p-4 rounded-xl font-bold capitalize bg-${c}-600 hover:scale-105 transition-transform`}>
                  {c} Player
                </button>
              ))}
            </div>
            <button onClick={() => setIsBurning(false)} className="mt-8 text-zinc-500 underline">إلغاء</button>
          </div>
        </div>
      )}
    </div>
  );
}

// --- وظائف مساعدة (Helpers) ---

function PlayerUI({ color, data, isTurn }) {
  const colors = { yellow: 'bg-yellow-500', blue: 'bg-blue-500', red: 'bg-red-500', green: 'bg-green-500' };
  return (
    <div className={`flex items-center gap-4 p-4 rounded-2xl transition-all ${isTurn ? 'bg-white/10 ring-2 ring-white scale-110 shadow-2xl' : 'opacity-50'}`}>
      <div className={`w-14 h-14 rounded-full ${colors[color]} flex items-center justify-center border-4 border-black/20 shadow-inner`}>
        <User size={28} />
      </div>
      <div>
        <p className="font-black text-sm uppercase tracking-widest">{data.name}</p>
        <div className="flex gap-1 mt-1">
          {data.marbles.map((m, i) => (
            <div key={i} className={`w-2 h-2 rounded-full ${m === -1 ? 'bg-white/20' : 'bg-green-400 animate-pulse'}`} />
          ))}
        </div>
      </div>
    </div>
  );
}

const getHolePosition = (i) => {
  const angle = (i / TOTAL_HOLES) * 2 * Math.PI - Math.PI / 2;
  const radius = 220;
  return { left: `${250 + radius * Math.cos(angle)}px`, top: `${250 + radius * Math.sin(angle)}px` };
};

const getMarblePosition = (pos, color, i) => {
  if (pos === -1) {
    const bases = { 
      yellow: { top: 30, left: 30 }, blue: { top: 30, right: 30 }, 
      red: { bottom: 30, right: 30 }, green: { bottom: 30, left: 30 } 
    };
    const b = bases[color];
    const offset = i * 32;
    return { ...b, transform: b.left !== undefined ? `translateX(${offset}px)` : `translateX(-${offset}px)` };
  }
  const angle = (pos / TOTAL_HOLES) * 2 * Math.PI - Math.PI / 2;
  const radius = 220;
  return { left: `${250 + radius * Math.cos(angle)}px`, top: `${250 + radius * Math.sin(angle)}px`, transform: 'translate(-10px, -10px)' };
};

const getSteps = (val) => {
  if (val === 'K') return 13;
  if (val === 'Q') return 12;
  if (val === 'J') return 11;
  if (val === 'A') return 1;
  if (val === '4') return -4;
  return parseInt(val) || 0;
};

const getStartPos = (color) => ({ yellow: 0, blue: 15, red: 30, green: 45 }[color]);
const getNextTurn = (curr) => {
  const order = ['yellow', 'blue', 'red', 'green'];
  return order[(order.indexOf(curr) + 1) % 4];
};
const getMarbleBg = (c) => ({ yellow: 'bg-yellow-400', blue: 'bg-blue-500', red: 'bg-red-600', green: 'bg-green-500' }[c]);

const isBetween = (start, end, pos) => {
  if (pos === -1) return false;
  if (start < end) return pos > start && pos < end;
  return pos > start || pos < end; // للدوران حول الصفر
};