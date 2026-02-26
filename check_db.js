const mongoose = require('mongoose');
const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/autoscuela';

mongoose.connect(uri).then(async () => {
  const db = mongoose.connection.db;
  const questions = await db.collection('questions').find({}).limit(5).toArray();
  for (let q of questions) {
    console.log(q._id, 'topic_tag:', q.topic_tag, 'question:', q.question);
  }
  process.exit(0);
});
