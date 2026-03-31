const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const Meeting = require('../../models/Meeting');

// POST api/meetings/create
// Creates an instant meeting
router.post('/create', async (req, res) => {
  try {
    const meetingId = uuidv4();
    res.json({ meetingId });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// POST api/meetings/schedule
// Schedules a future meeting
router.post('/schedule', async (req, res) => {
  const { title, startTime, duration, host } = req.body;
  try {
    const meetingId = uuidv4();
    const meeting = new Meeting({
      host,
      meetingId,
      title,
      startTime,
      duration
    });
    await meeting.save();
    res.json(meeting);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// GET api/meetings/:id
// Gets info about a meeting
router.get('/:id', async (req, res) => {
  try {
    const meeting = await Meeting.findOne({ meetingId: req.params.id });
    if (!meeting) return res.status(404).json({ msg: 'Meeting not found' });
    res.json(meeting);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

module.exports = router;
