const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3001;
const DATA_DIR = path.join(__dirname, 'data');

app.use(express.json());
app.use(express.static(__dirname));

const NOTES_DIR = path.join(DATA_DIR, 'notes');
const CONFIG_FILE = path.join(DATA_DIR, 'config.json');
const SAMPLE_CONFIG_FILE = path.join(DATA_DIR, 'sample-config.json');

// Serve config (falls back to sample if config.json not found)
app.get('/api/config', (req, res) => {
  try {
    const file = fs.existsSync(CONFIG_FILE) ? CONFIG_FILE : SAMPLE_CONFIG_FILE;
    res.json(JSON.parse(fs.readFileSync(file, 'utf8')));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Per-person 1:1 notes
app.get('/api/notes/:id', (req, res) => {
  try {
    const file = path.join(NOTES_DIR, req.params.id + '.md');
    const content = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
    res.json({ content });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/notes/:id', (req, res) => {
  try {
    const file = path.join(NOTES_DIR, req.params.id + '.md');
    fs.writeFileSync(file, req.body.content || '');
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Serve all data in one call
app.get('/api/data', (req, res) => {
  try {
    const deals    = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'deals.json'),    'utf8'));
    const events   = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'events.json'),   'utf8'));
    const projects = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'projects.json'), 'utf8'));
    const partners = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'partners.json'), 'utf8'));
    const people   = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'people.json'),   'utf8'));
    const ytd      = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'ytd.json'),      'utf8'));
    res.json({ deals, events, projects, partners, people, ytd, updatedAt: fs.statSync(path.join(DATA_DIR, 'deals.json')).mtime });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Let Claude (or any script) update data files via POST
app.post('/api/data', (req, res) => {
  try {
    const { deals, events, projects } = req.body;
    if (deals)    fs.writeFileSync(path.join(DATA_DIR, 'deals.json'),    JSON.stringify(deals, null, 2));
    if (events)   fs.writeFileSync(path.join(DATA_DIR, 'events.json'),   JSON.stringify(events, null, 2));
    if (projects) fs.writeFileSync(path.join(DATA_DIR, 'projects.json'), JSON.stringify(projects, null, 2));
    if (partners) fs.writeFileSync(path.join(DATA_DIR, 'partners.json'), JSON.stringify(partners, null, 2));
    res.json({ ok: true, dealsCount: deals?.length, eventsCount: events?.length, projectsCount: projects?.length, partnersCount: partners?.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`\n  SE Manager Dashboard`);
  console.log(`  http://localhost:${PORT}\n`);
});
