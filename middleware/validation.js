const crypto = require('crypto');
const { register } = require('module');

module.exports = function (req, res, next) {

  // check for either a email or refresh, and use it for checking db
  // only need to check if the token exists.
  // if exists, return, if not then say invalid/expireed.
  // used only for people/id, refresh and login
  // not used for email prfile necessarily, maybe use anyways?
  // only for use after authorization

  // ignore above

  // check only a provided jwt in body (refresh token) exissts in database
  // also check it is a valid token (like with jwt (verigyu))

  const refresh = req.body.refreshToken;

  try {
      jwt.verify(tokenValue, process.env.JWT_SECRET);

      // handle encrption

      req.db
        .from("users")
        .select("refreshToken")
        .where("refreshToken", refresh)
        .then((refreshToken) => {
          // if !refreshToken
          if (refreshToken != refresh) {
            return ('ga')
          }
        })
  } catch (e) {
    if (e.name === "TokenExpiredError") {
      return res.status(401).json({ error: true, message: "JWT token has expired" });
    } else {
      return res.status(401).json({ error: true, message: "Invalid JWT token" });
    }
  }

  next();

  next();
}