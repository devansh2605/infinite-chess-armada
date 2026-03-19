const express = require('express');
const cors = require('cors');
const path = require('path');
const favicon = require('serve-favicon');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
const logger = require('./logger');
const config = require('./config');

const app = express();

// CORS — allow frontend origin (Vercel in prod, localhost in dev)
app.use(cors({
	origin: config.frontendUrl,
	credentials: true,
	methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
}));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(favicon(path.join(__dirname, '..', 'client', 'favicon.png')));
app.use(express.static(path.join(__dirname, '..', 'client')));

const games = require('./routes/games');
const auth = require('./routes/auth');
const lobby = require('./routes/lobby');
const ratings = require('./routes/ratings');

app.use('/api/games', games);
app.use('/api/auth', auth);
app.use('/api/lobby', lobby);
app.use('/api/ratings', ratings);

// Serve SPA for all non-API routes
app.get(/^(?!\/api).*$/, (req, res) => {
	res.sendFile(path.resolve(__dirname, '..', 'client', 'index.html'));
});

app.use((req, res) => {
	res.status(404).send('<h1>404 Not Found</h1>');
});

app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
	if (err.status === 401) {
		res.sendStatus(401);
	} else {
		logger.error(err);
		res.status(500).send('<h1>Internal Server Error</h1>');
	}
});

module.exports = app;
