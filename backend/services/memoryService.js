// backend/services/memoryService.js
// ─────────────────────────────────────────────────────────────────────────────
// Decision Memory — Phase 2.5
// Saves, loads, updates, and deletes comparison history.
// Primary storage: Firebase Firestore
// Fallback storage: in-memory array (if Firebase not configured)
// ─────────────────────────────────────────────────────────────────────────────

const MAX_ENTRIES = 20;
const COLLECTION  = 'comparisons';

// ── Firebase init (lazy — only if env vars present) ──────────────────────────
let db = null;

async function getDb() {
  if (db) return db;

  const apiKey     = process.env.FIREBASE_API_KEY;
  const projectId  = process.env.FIREBASE_PROJECT_ID;
  const appId      = process.env.FIREBASE_APP_ID;

  if (!apiKey || !projectId || !appId) {
    console.log('[Memory] Firebase not configured — using in-memory fallback');
    return null;
  }

  try {
    const { initializeApp, getApps } = await import('firebase/app');
    const { getFirestore }           = await import('firebase/firestore');

    // Avoid re-initializing if already done
    const existing = getApps().find(a => a.name === 'vonnue');
    const app = existing || initializeApp({ apiKey, projectId, appId }, 'vonnue');
    db = getFirestore(app);
    console.log('[Memory] Firebase connected ✅');
    return db;
  } catch (err) {
    console.error('[Memory] Firebase init failed:', err.message);
    return null;
  }
}

// ── In-memory fallback ────────────────────────────────────────────────────────
const memoryFallback = [];

// ── Title generator ───────────────────────────────────────────────────────────
function generateTitle(products) {
  if (!products || products.length === 0) return `Comparison — ${formatDate(new Date())}`;

  const shortened = products.map(name => {
    const words = name.split(/\s+/).slice(0, 3).join(' ');
    return words.length > 30 ? words.substring(0, 28) + '…' : words;
  });

  const joined = shortened.join(' vs ');
  const timeStamp = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

  if (joined.length > 60) {
    return `${shortened[0]} +${products.length - 1} more (${timeStamp})`;
  }
  return `${joined} (${timeStamp})`;
}

function formatDate(date) {
  return new Date(date).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric'
  });
}

// ── SAVE ─────────────────────────────────────────────────────────────────────
async function saveComparison(payload) {
  const {
    products,       // string[]
    criteria,       // string[]
    winner,         // string
    result,         // full calculateDecision() output
    products_data,  // data matrix
    source,         // 'smart' | 'manual'
    ruled_out = [],
    images = {},
  } = payload;

  const entry = {
    title:        generateTitle(products),
    timestamp:    new Date().toISOString(),
    source:       source || 'manual',
    winner:       winner || null,
    products:     products || [],
    criteria:     criteria || [],
    criteriaCount: (criteria || []).length,
    result:       result || {},
    products_data: products_data || {},
    ruled_out:    ruled_out,
    images:       images,
  };

  const firestore = await getDb();

  if (firestore) {
    try {
      const { collection, addDoc, query, orderBy, getDocs, deleteDoc, doc, limit } =
        await import('firebase/firestore');

      const colRef = collection(firestore, COLLECTION);
      const docRef = await addDoc(colRef, entry);
      console.log(`[Memory] Saved to Firebase: ${docRef.id}`);

      // Enforce MAX_ENTRIES — delete oldest if over limit
      const q = query(colRef, orderBy('timestamp', 'desc'));
      const snap = await getDocs(q);
      if (snap.size > MAX_ENTRIES) {
        const toDelete = snap.docs.slice(MAX_ENTRIES);
        for (const d of toDelete) {
          await deleteDoc(doc(firestore, COLLECTION, d.id));
        }
        console.log(`[Memory] Pruned ${toDelete.length} old entries`);
      }

      return { id: docRef.id, ...entry };
    } catch (err) {
      console.error('[Memory] Firebase save failed:', err.message);
    }
  }

  // Fallback
  const id = `local_${Date.now()}`;
  const saved = { id, ...entry };
  memoryFallback.unshift(saved);
  if (memoryFallback.length > MAX_ENTRIES) memoryFallback.pop();
  console.log('[Memory] Saved to in-memory fallback:', id);
  return saved;
}

// ── LIST ─────────────────────────────────────────────────────────────────────
async function listComparisons() {
  const firestore = await getDb();

  if (firestore) {
    try {
      const { collection, query, orderBy, getDocs, limit } =
        await import('firebase/firestore');

      const q = query(
        collection(firestore, COLLECTION),
        orderBy('timestamp', 'desc'),
        limit(MAX_ENTRIES)
      );
      const snap = await getDocs(q);
      const entries = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      console.log(`[Memory] Loaded ${entries.length} entries from Firebase`);
      return entries;
    } catch (err) {
      console.error('[Memory] Firebase list failed:', err.message);
    }
  }

  // Fallback
  return [...memoryFallback];
}

// ── DELETE ───────────────────────────────────────────────────────────────────
async function deleteComparison(id) {
  const firestore = await getDb();

  if (firestore) {
    try {
      const { doc, deleteDoc } = await import('firebase/firestore');
      await deleteDoc(doc(firestore, COLLECTION, id));
      console.log(`[Memory] Deleted from Firebase: ${id}`);
      return true;
    } catch (err) {
      console.error('[Memory] Firebase delete failed:', err.message);
    }
  }

  // Fallback
  const idx = memoryFallback.findIndex(e => e.id === id);
  if (idx !== -1) {
    memoryFallback.splice(idx, 1);
    console.log(`[Memory] Deleted from fallback: ${id}`);
    return true;
  }
  return false;
}

// ── RENAME ───────────────────────────────────────────────────────────────────
async function renameComparison(id, newTitle) {
  if (!newTitle || !newTitle.trim()) return false;

  const firestore = await getDb();

  if (firestore) {
    try {
      const { doc, updateDoc } = await import('firebase/firestore');
      await updateDoc(doc(firestore, COLLECTION, id), { title: newTitle.trim() });
      console.log(`[Memory] Renamed ${id} → "${newTitle}"`);
      return true;
    } catch (err) {
      console.error('[Memory] Firebase rename failed:', err.message);
    }
  }

  // Fallback
  const entry = memoryFallback.find(e => e.id === id);
  if (entry) {
    entry.title = newTitle.trim();
    return true;
  }
  return false;
}

module.exports = { saveComparison, listComparisons, deleteComparison, renameComparison };
