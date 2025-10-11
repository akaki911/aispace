
const { UserClassifier } = require('../models/predictor.js');

class PredictionService {
  constructor() {
    this.classifier = new UserClassifier();
  }

  async predict(input) {
    // Logging function at start of predict()
    console.log(`🔍 [PredictionService] Starting prediction for input:`, {
      timestamp: new Date().toISOString(),
      inputType: typeof input,
      inputLength: input?.length || 0
    });

    try {
      const result = await this.classifier.predict(input);
      console.log(`✅ [PredictionService] Prediction completed successfully`);
      return result;
    } catch (error) {
      console.error(`❌ [PredictionService] Prediction failed:`, error);
      throw error;
    }
  }
}

module.exports = { PredictionService };
