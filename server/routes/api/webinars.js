const express = require('express');
const router = express.Router();
const Webinar = require('../../models/Webinar');

// POST api/webinars/create
// Creates a new instant webinar
router.post('/create', async (req, res) => {
  try {
    // Generate a short 7-character ID
    const webinarId = Math.random().toString(36).substring(2, 9);
    
    const webinar = new Webinar({
      webinarId,
      title: 'Instant Webinar',
      description: 'Host broadcast-style event',
      startTime: new Date(),
      duration: 120 // 2 hours default
    });
    
    await webinar.save();
    res.json({ webinarId: webinar.webinarId });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// POST api/webinars/schedule
// Schedules a future webinar
router.post('/schedule', async (req, res) => {
  const { title, description, startTime, duration, host } = req.body;
  try {
    const webinarId = Math.random().toString(36).substring(2, 9);
    const webinar = new Webinar({
      host,
      webinarId,
      title,
      description,
      startTime,
      duration
    });
    await webinar.save();
    res.json(webinar);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// GET api/webinars/:id
// Validates and fetches info about a webinar
router.get('/:id', async (req, res) => {
  try {
    const webinar = await Webinar.findOne({ webinarId: req.params.id });
    if (!webinar) return res.status(404).json({ msg: 'Webinar not found' });
    res.json(webinar);
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ msg: 'Webinar not found' });
    }
    res.status(500).send('Server error');
  }
});

module.exports = router;
