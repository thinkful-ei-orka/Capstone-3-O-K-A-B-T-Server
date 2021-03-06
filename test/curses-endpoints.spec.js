const knex = require('knex');
const app = require('../src/app');
const helpers = require('./test-helpers');
const supertest = require('supertest');
const { expect } = require('chai');

describe('Curses Endpoints', function () {
  let db;
  const { testCurses, testUsers, testBlessings } = helpers.makeFixtures();

  before('make knex instance', () => {
    db = knex({
      client: 'pg',
      connection: process.env.TEST_DATABASE_URL,
    });
    app.set('db', db);
  });

  after('disconnect from db', async () => await db.destroy());
  before('cleanup', async () => await helpers.cleanTables(db));
  afterEach('cleanup', async () => await helpers.cleanTables(db));

  describe('GET /api/curses/', () => {
    context('no available curses for blessing', () => {
      beforeEach('insert users', async () => {
        await helpers.seedUsers(db, testUsers);
      });
      it(`responds with 200 and "No available curses"`, () => {
        return supertest(app)
          .get('/api/curses/')
          .set('Authorization', `Bearer ${helpers.makeAuthHeader(testUsers[0])}`)
          .expect(200)
          .expect(res => expect(res.body).to.eql('No available curses'));
      });
    });

    context('no user is logged in', () => {
      it('responds with 401  and {error: "Missing bearer token"}', () => {
        return supertest(app)
          .get('/api/curses/')
          .expect(401)
          .expect(res => expect(res.body).to.eql({ error: 'Missing bearer token' }));
      });
    });

    context('curses available for blessing and logged in', () => {
      let pulledCurse;
      let editedCurse;
      beforeEach('seed blessings/users/curses', async () => {
        await helpers.seedBlessings(db, testBlessings);
        await helpers.seedUsers(db, testUsers);
        await helpers.seedCurses(db, testCurses);
      });
      it('responds with 200 and the curse information for blessing', () => {
        return supertest(app)
          .get('/api/curses/')
          .set('Authorization', `Bearer ${helpers.makeAuthHeader(testUsers[1])}`)
          .expect(200)
          .expect(res => {
            pulledCurse = res.body.curse_id;
            expect(res.body).to.have.property('curse_id');
            expect(res.body).to.have.property('curse');
          })
          .then(async () => {
            editedCurse = await helpers.getCurseById(db, pulledCurse);
          });
      });

      it('updates the curse in the database with the user_id and time of pull', () => {
        expect(editedCurse.pulled_by).to.eql(testUsers[1].user_id);
        expect(Date.now() - new Date(editedCurse.pulled_time) < 10000);
      });

      it(`doesn't allow curses from the user's blocklist`, () => {
        return supertest(app)
          .get('/api/curses')
          .set('Authorization', `Bearer ${helpers.makeAuthHeader(testUsers[2])}`)
          .expect(200)
          .then(async () => {
            const availableForUser3 = await helpers.getAllAvailableCurses(db, 3);
            expect(availableForUser3).to.eql([]);
          });
      });
    });
  });

  describe('POST /api/curses/', () => {
    context('user is anonymous', () => {
      it(`responds with 201 and 'Curse sent annonymously' and user:null`, () => {
        return supertest(app)
          .post('/api/curses/')
          .send({ curse: 'Testing for a valid curse' })
          .expect(201, { message: 'Curse sent annonymously', curse: 'Testing for a valid curse', user: null });
      });
    });

    context('user is signed in', () => {
      beforeEach('seed users', async () => {
        await helpers.seedUsers(db, testUsers);
      });
      context('no curse field in body', () => {
        it(`responds with 400 and "'curse' field is required in body"`, () => {
          return supertest(app)
            .post('/api/curses/')
            .set('Authorization', `Bearer ${helpers.makeAuthHeader(testUsers[0])}`)
            .send()
            .expect(400, `"'curse' field is required in body"`);
        });
      });
      context('input is empty', () => {
        it(`responds with 400 and 'Cannot send an empty curse'`, () => {
          return supertest(app)
            .post('/api/curses/')
            .set('Authorization', `Bearer ${helpers.makeAuthHeader(testUsers[0])}`)
            .send({ curse: "" })
            .expect(400, '"Cannot send an empty curse"');
        });
      });
      context('input is less than 15 characters', () => {
        it(`responds with 400 and 'Must be longer than 10 characters'`, () => {
          return supertest(app)
            .post('/api/curses/')
            .set('Authorization', `Bearer ${helpers.makeAuthHeader(testUsers[0])}`)
            .send({ curse: "Test" })
            .expect(400, '"Must be longer than 10 characters"');
        });
      });
      context('input is less than 3 words', () => {
        it(`responds with 400 and 'Must be longer than 3 words'`, () => {
          return supertest(app)
            .post('/api/curses/')
            .set('Authorization', `Bearer ${helpers.makeAuthHeader(testUsers[0])}`)
            .send({ curse: "Test curse" })
            .expect(400, '"Must be longer than 3 words"');
        });
      });
      context('input is more than 400 characters', () => {
        it(`responds with 400 and 'Must be less than 400 characters'`, () => {
          return supertest(app)
            .post('/api/curses/')
            .set('Authorization', `Bearer ${helpers.makeAuthHeader(testUsers[0])}`)
            .send({ curse: "12345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678 9 0 1" })
            .expect(400, '"Must be less than 400 characters"');
        });
      });
      context('input is valid', () => {
        it(`responds with 201, the curse, the username, and a message "Curse sent as 'username'"`, () => {
          return supertest(app)
            .post('/api/curses/')
            .set('Authorization', `Bearer ${helpers.makeAuthHeader(testUsers[0])}`)
            .send({ curse: "Testing string for a valid curse" })
            .expect(201, { curse: 'Testing string for a valid curse', user: testUsers[0].username, message: `Curse sent as '${testUsers[0].username}'` });
        });
      });
    });
  });

  describe('PATCH /api/curses/', () => {
    beforeEach('seed users, blessings, curses', async () => {
      await helpers.seedUsers(db, testUsers);
      await helpers.seedBlessings(db, testBlessings);
      await helpers.seedCurses(db, testCurses);
    });
    context('user is not logged in', () => {
      it('returns 401 not Authorized', () => {
        return supertest(app)
          .patch('/api/curses/')
          .expect(401)
          .expect({ error: 'Missing bearer token' });
      });
    });
    context('user is logged in', () => {
      const sendObject = { blessing_id: 1, curse_id: 1 };
      context('user is out of blessings', () => {
        context('user is not permitted to replenish blessings', () => {
          it(`returns 403 and "You're out of blessings"`, () => {
            return supertest(app)
              .patch('/api/curses/')
              .send(sendObject)
              .set('Authorization', `Bearer ${helpers.makeAuthHeader(testUsers[1])}`)
              .expect(403)
              .expect(`"You're out of blessings"`);
          });
        });
        context('user is permitted to replenish blessings', () => {
          it('allows the blessing to occur, but resets the blessings beforehand', () => {
            return supertest(app)
              .patch('/api/curses/')
              .send(sendObject)
              .set('Authorization', `Bearer ${helpers.makeAuthHeader(testUsers[2])}`)
              .expect(202)
              .expect(`"Curse blessed with blessing ${1}!"`)
              .then(async () => {
                const user = await helpers.getUserById(db, 3);
                return expect(user.limiter).to.eql(2);
              });
          });
        });
      });
      context('user has blessings available', () => {
        context('req body does not contain the appropriate fields', () => {
          const requiredFields = ['blessing_id', 'curse_id'];
          requiredFields.forEach(field => {
            let sendObject = { blessing_id: 1, curse_id: 1 };
            delete sendObject[field];
            it(`responds with 'Missing ${field} in body`, () => {
              return supertest(app)
                .patch('/api/curses/')
                .send(sendObject)
                .set('Authorization', `Bearer ${helpers.makeAuthHeader(testUsers[0])}`)
                .expect(400)
                .expect(`"Missing ${field} in body"`);
            });
          });
        });
        context('user sends a valid requiest', () => {
          const sendObject = { blessing_id: 1, curse_id: 1 };
          it("Updates the curse with the desired information and returns 202: 'Curse blessed with blessing {blessing_id}'", () => {
            return supertest(app)
              .patch('/api/curses/')
              .set('Authorization', `Bearer ${helpers.makeAuthHeader(testUsers[0])}`)
              .send(sendObject)
              .expect(202)
              .expect('"Curse blessed with blessing 1!"')
              .then(async () => {
                const curse = await helpers.getCurseById(db, 1);
                expect(curse.blessed).to.eql(true);
                expect(curse.blessing).to.eql(1);
              });
          });
        });
      });
    });

  });

  describe('DELETE /api/curses/', () => {
    context('body does not contain curse_id', () => {
      before('seed user', async () => {
        await helpers.seedUsers(db, testUsers);
      });
      it('responds with 400 and "body does not contain curse_id for deletion', () => {
        return supertest(app)
          .delete('/api/curses/')
          .set('Authorization', `Bearer ${helpers.makeAuthHeader(testUsers[0])}`)
          .expect(400)
          .expect('"body does not contain curse_id for deletion"');
      });
    });
    context('body contains curse_id', () => {
      context('user is not the curse originator', () => {
        beforeEach('seed users, blessings, curses', async () => {
          await helpers.seedUsers(db, testUsers);
          await helpers.seedBlessings(db, testBlessings);
          await helpers.seedCurses(db, testCurses);
        });
        it('responds with 403: "User is not the owner of provided curse"', () => {
          return supertest(app)
            .delete('/api/curses/')
            .set('Authorization', `Bearer ${helpers.makeAuthHeader(testUsers[0])}`)
            .send({ curse_id: 2 })
            .expect(403)
            .expect('"User is not the owner of provided curse"');
        });
      });
      context('user is curse originator', () => {
        beforeEach('seed users, blessings, curses', async () => {
          await helpers.seedUsers(db, testUsers);
          await helpers.seedBlessings(db, testBlessings);
          await helpers.seedCurses(db, testCurses);
        });
        it('responds with 200 and the deleted curse', async () => {
          const deletedCurse = await helpers.getCurseById(db, 4);
          const { curse_id, curse, user_id, blessed, blessing, pulled_by, pulled_time } = deletedCurse;
          return supertest(app)
            .delete('/api/curses/')
            .set('Authorization', `Bearer ${helpers.makeAuthHeader(testUsers[0])}`)
            .send({ curse_id: 4 })
            .expect(200)
            .expect({
              deletedCurse: {
                curse_id: curse_id,
                curse: curse,
                user_id: user_id,
                blessed: blessed,
                blessing: blessing,
                pulled_by: pulled_by,
                pulled_time: pulled_time.toISOString()
              }
            });
        });
      });
    });
  });
});