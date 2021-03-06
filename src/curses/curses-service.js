const CursesService = {
  postCurse(db, curse, user_id = null) {
    return db
      .insert({ curse, user_id })
      .into('curses')
      .returning('*')
      .then(([curse]) => curse);
  },
  incrementBlessingCount(db, user, time) {
    return db
      .from('users')
      .update({
        totalblessings: user.totalblessings + 1,
        lastblessing: time,
        limiter: user.limiter - 1
      })
      .where('user_id', user.user_id);
  },

  async blessCurse(db, curseId, blessingId, user, time) {
    await this.incrementBlessingCount(db, user, time);
    return db
      .from('curses')
      .update({
        blessed: true,
        blessing: blessingId
      })
      .where('curse_id', curseId);
  },

  resetUserLimit(db, user_id) {
    return db
      .from('users')
      .update({
        limiter: 3
      })
      .where('user_id', user_id);
  },

  getBlockList(db, user_id) {
    return db
      .select('blocklist')
      .from('users')
      .where('user_id', user_id)
      .first();
  },

  async getAllCurses(db, user_id) {
    let blocklist = await this.getBlockList(db, user_id);
    blocklist = blocklist.blocklist;
    return blocklist === null ?
      db
        .from('curses')
        .select('*')
        .whereNot("user_id", user_id)
        .where("pulled_by", null)
        .orWhereNull('user_id')
      :
      db
        .from('curses')
        .select('*')
        .whereNot("user_id", user_id)
        .whereNotIn('user_id', blocklist)
        .where("pulled_by", null)
        .orWhereNull('user_id');
  },

  getCurseById(db, curse_id) {
    return db
      .from('curses')
      .select('*')
      .where('curse_id', curse_id)
      .first();
  },

  updateCursePulled(db, curse_id, user_id) {
    return db
      .from('curses')
      .update({
        pulled_by: user_id,
        pulled_time: new Date()
      })
      .where("curse_id", curse_id);
  },
  deleteBlessedCurse(db, curse_id) {
    return db
      .from('curses')
      .where('curse_id', curse_id)
      .del();
  },
  getUserById(db, user_id) {
    return db
      .select()
      .from('users')
      .where('user_id', user_id)
      .first();
  },
  deleteBlessedAnonymousCurses(db) {
    return db
      .from('curses')
      .whereRaw("user_id is null and blessed = true")
      .orWhereRaw("user_id is null and not pulled_by is null and pulled_time < now() - interval '1 hour'")
      .del();
  }
};

module.exports = CursesService;