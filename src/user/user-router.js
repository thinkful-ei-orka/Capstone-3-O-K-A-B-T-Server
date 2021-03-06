const express = require('express');
const path = require('path');
const UserService = require('./user-service');
const { requireAuth } = require('../middleware/jwt-auth');

const userRouter = express.Router();
const jsonBodyParser = express.json();

userRouter
  .route('/')
  //add new user to db
  .post(jsonBodyParser, async (req, res, next) => {
    const { password, username, name } = req.body;

    for (const field of ['name', 'username', 'password'])
      if (!req.body[field])
        return res.status(400).json({
          error: `Missing '${field}' in request body`
        });

    try {
      const passwordError = UserService.validatePassword(password);

      if (passwordError)
        return res.status(400).json({ error: passwordError });

      const hasUserWithUserName = await UserService.hasUserWithUserName(
        req.app.get('db'),
        username
      );

      if (hasUserWithUserName)
        return res.status(400).json({ error: `Username already taken` });

      const hashedPassword = await UserService.hashPassword(password);

      const newUser = {
        username,
        password: hashedPassword,
        name,
      };

      const user = await UserService.insertUser(
        req.app.get('db'),
        newUser
      );

      res
        .status(201)
        .json(UserService.serializeUser(user));
    } catch (error) {
      next(error);
    }
  })
  //pull user data and blessed curses
  .get(requireAuth, jsonBodyParser, async (req, res, next) => {
    const { user_id, name, username, totalblessings, lastblessing, limiter } = req.user;

    await UserService.oldCurseResponse(req.app.get('db'), req.user.user_id);

    const blessedCurses = await UserService.blessedCurses(req.app.get('db'), user_id);

    //default blessing (currently set to 1)
    blessedCurses.forEach(curse => curse.blessing === null ? curse.blessing = 1 : null);

    return res.status(200).json({
      user: { name, username, totalblessings, lastblessing, limiter },
      blessedCurses: blessedCurses
    });
  })
  //add user to specific user's blocklist
  .patch(requireAuth, jsonBodyParser, async (req, res, next) => {
    if (!req.body.curse_id) {
      return res.status(400).json("no 'curse_id' found in body");
    }
    const blocked_id = await UserService.getUserFromCurseId(req.app.get('db'), req.body.curse_id);
    await UserService.updateBlocklist(req.app.get('db'), req.user.user_id, blocked_id.user_id);
    res.status(202).json(`User ${blocked_id.user_id} added to the blocklist`);
  });

module.exports = userRouter;
