
const express = require("express");
const router = express.Router();
const { rememberFact, getMemory, addToMemory } = require("../memory_controller");

// დაიმახსოვრე ფაქტი
router.post("/remember", async (req, res) => {
  const { userId, fact, memory } = req.body;
  const factToStore = fact || memory;
  
  if (!userId || !factToStore) {
    return res.status(400).json({ 
      error: "userId და fact/memory აუცილებელია",
      success: false 
    });
  }

  try {
    await addToMemory(userId, factToStore);
    res.json({ 
      success: true, 
      message: "🧠 ინფორმაცია დამახსოვრდა!",
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Remember endpoint error:', error);
    res.status(500).json({ 
      error: "მეხსიერებაში შენახვა ვერ მოხერხდა",
      success: false 
    });
  }
});

// წაიკითხე მეხსიერება
router.get("/memory/:userId", async (req, res) => {
  const { userId } = req.params;
  
  try {
    const data = await getMemory(userId);
    res.json(data || { 
      data: null, 
      message: "მეხსიერება ცარიელია",
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Memory fetch endpoint error:', error);
    res.status(500).json({ 
      error: "მეხსიერების წაკითხვა ვერ მოხერხდა",
      success: false 
    });
  }
});

// წაშალე მეხსიერება
router.delete("/memory/:userId", async (req, res) => {
  const { userId } = req.params;
  
  try {
    const { getFirestore } = require("firebase-admin/firestore");
    const db = getFirestore();
    
    await db.collection("memory").doc(userId).delete();
    res.json({ 
      success: true, 
      message: "🧠 მეხსიერება წაიშალა!",
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Memory delete endpoint error:', error);
    res.status(500).json({ 
      error: "მეხსიერების წაშლა ვერ მოხერხდა",
      success: false 
    });
  }
});

module.exports = router;
