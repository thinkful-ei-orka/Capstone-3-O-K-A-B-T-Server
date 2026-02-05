require('dotenv').config();
const express = require('express');
const morgan = require('morgan');
const cors = require('cors');
const helmet = require('helmet');
const { NODE_ENV } = require('./config');
const authRouter = require('./auth/auth-router');
const errorHandler = require('./middleware/error-handler');
const userRouter = require('./user/user-router');
const blessingsRouter = require('./blessings/blessings-router');
const cursesRouter = require('./curses/curses-router');
const quotesRouter = require('./quotes/quotes-router');

const app = express();

app.use(morgan((NODE_ENV === 'production') ? 'tiny' : 'common', {
  skip: () => NODE_ENV === 'test',
}));
app.use(helmet());
app.use(cors());
app.use(cors({origin: "https://capstone-3-oabkt.vercel.app/"}));

app.use('/api/auth', authRouter);
app.use('/api/user', userRouter);
app.use('/api/blessings', blessingsRouter);
app.use('/api/curses', cursesRouter);
app.use('/api/quotes', quotesRouter);

app.use(errorHandler);

module.exports = app;
