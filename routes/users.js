const jwt = require('jsonwebtoken');
var express = require('express');
const bcrypt = require('bcrypt');
var router = express.Router();
const crypto = require('crypto');
const authorization = require('../middleware/authorization');
const validation = require('../middleware/validation')

const { stringify } = require('querystring');
const { error } = require('console');
const { token } = require('morgan');

// Refactor code
// Clean code
// Implement the refresh token storage in DB
//    Need to consider the relevant endpoints (login, refresh, authorise, profile)
//    Store only the valid token and always check to see it in validation middleware
//    If not match then return error
//    When logout, delete tokens
//    When refresh or login, update tokens
//    store hashes of tokens and check
//    search db based on email or token (searching on token fine since tokens cant have collisions)
// Meticulous error handling (all then blocks, try blocks, db search, etc.)
// Finish the openapi json
// Add https (prac)
// deploy (prac)

function isValidDOB(dob) {
  // 1. Check format with regex
  const regex = /^\d{4}-\d{2}-\d{2}$/;
  if (!regex.test(dob)) return false;

  // 2. Parse date
  const date = new Date(dob);
  if (Number.isNaN(date.getTime())) return false; // Invalid date

  // 3. Check if the parts match exactly (to catch edge cases)
  const [year, month, day] = dob.split("-");
  const iso = date.toISOString().slice(0, 10); // "YYYY-MM-DD"
  return iso === `${year}-${month}-${day}`;
}

function isPastDOB(dob) {
  // 1. Check format with regex
  const regex = /^\d{4}-\d{2}-\d{2}$/;
  if (!regex.test(dob)) return false;

  // 2. Parse date
  const date = new Date(dob);
  const today = new Date();

  return date < today;
}

function emailValidation(token) {

}


// router.get ('/people/:id')  -- needs cleaning + error handling
router.post('/register', function(req, res, next) {
  const email = req.body.email;
  const password = req.body.password;

  if (!email || !password) {
    return res.status(400).json({
      error: true,
      message: "Request body incomplete, both email and password are required"
    });
  }

  const queryUsers = req.db.from("users").select("*").where("email", "=", email);
  queryUsers.then(users => {
    if (users.length > 0) {
      console.log("User already exists");
      return res.status(409).json({ error: true, message:"User already exists"})
    }

    console.log("No matching users");

    // Insert user into DB
    const saltRounds = 10;
    const hash = bcrypt.hashSync(password, saltRounds);
    return req.db.from("users").insert({ email, hash });
  })
    .then(() => {
      console.log("User created");
      res.status(201).json({ message: "User created" });
    })
    .catch(e => {
      console.log("Error creating user", e);
      res.status(500).json({ error: true, message: e.message });
    });
});

// router.post('/login')  -- needs cleaning + error handling
router.post('/login', (req, res) => {
  const email = req.body.email;
  const password = req.body.password;
  const longExpiry = req.body.longExpiry;
  const bearerExpiresInSeconds = longExpiry === 'true' ? 31536000 : req.body.bearerExpiresInSeconds || 600;
  const refreshExpiresInSeconds = longExpiry === 'true' ? 31536000 : req.body.refreshExpiresInSeconds || 86400;

  if (!email || !password) {
    return res.status(400).json({
      error: true,
      message: "Request body incomplete, both email and password are required"
    });
  }

  req.db.from("users").select("*").where("email", "=", email)
    .then(users => {
      if (users.length === 0) {
        return res.status(401).json({ error: true,
          message: "Incorrect email or password" });
      }

      const user = users[0];
      return bcrypt.compare(password, user.hash).then(match => {
        if (!match) {
          return res.status(401).json({ error: true,
            message: "Incorrect email or password" });
        }

        const refreshExp = Math.floor(Date.now() / 1000) + refreshExpiresInSeconds;
        const bearerExp = Math.floor(Date.now() / 1000) + bearerExpiresInSeconds;

        const bearerToken = jwt.sign({ email, exp: bearerExp }, process.env.JWT_SECRET);
        const refreshToken = jwt.sign({ email, exp: refreshExp }, process.env.JWT_SECRET);

        // const saltRounds = 10;
        // const hashBearerr = bcrypt.hashSync(bearerToken, saltRounds);
        // const hashRefreshh = bcrypt.hashSync(refreshToken, saltRounds)

        const hashBearer = crypto.createHash('sha256').update(bearerToken).digest('hex');
        const hashRefresh = crypto.createHash('sha256').update(refreshToken).digest('hex');

        console.log(hashBearer)
        console.log(hashRefresh)

        req.db.from("users").where("email", "=", email).update({ bearerToken: hashBearer, refreshToken: hashRefresh })
        .then(() => {
          return res.status(200).json({
            bearerToken: {
              token: bearerToken,
              token_type: "Bearer",
              expires_in: bearerExpiresInSeconds
            },
            refreshToken: {
              token: refreshToken,
              token_type: "Refresh",
              expires_in: refreshExpiresInSeconds
            }
          });
        })
      });
    })
    .catch(err => {
      console.error("Login error:", err);
      return res.status(500).json({ error: true,
        message: "Internal server error" });
    });
});

// router.post('/refresh')  -- needs cleaning + error handling
router.post('/refresh', (req, res) => {
  // maybe invalidate?
  const token = req.body.refreshToken;
  const bearerExpiresInSeconds = 600;
  const refreshExpiresInSeconds = 86400;

  if (!token) {
    return res.status(400).json({
      error: true,
      message: "Request body incomplete, refresh token required"
    });
  }

  try {
      jwt.verify(token, process.env.JWT_SECRET);

      const refreshExp = Math.floor(Date.now() / 1000) + 600;
      const bearerExp = Math.floor(Date.now() / 1000) + 86400;

      const bearerToken = jwt.sign({ exp: bearerExp }, process.env.JWT_SECRET);
      const refreshToken = jwt.sign({ exp: refreshExp }, process.env.JWT_SECRET);

      const oldHashRrfresh = crypto.createHash('sha256').update(token).digest('hex')

      // const saltRounds = 10;
      // const hashBearerr = bcrypt.hashSync(bearerToken, saltRounds);
      // const hashRefreshh = bcrypt.hashSync(refreshToken, saltRounds)

      const hashBearer = crypto.createHash('sha256').update(bearerToken).digest('hex');
      const hashRefresh = crypto.createHash('sha256').update(refreshToken).digest('hex');

    req.db.from("users").where("refreshToken", "=", oldHashRrfresh).update({ bearerToken: hashBearer, refreshToken: hashRefresh })
      .then(() => {

        return res.status(200).json({
          bearerToken: {
            token: bearerToken,
            token_type: "Bearer",
            expires_in: bearerExpiresInSeconds
          },
          refreshToken: {
            token: refreshToken,
            token_type: "Refresh",
            expires_in: refreshExpiresInSeconds
          }
        });
      })
  } catch (e) {
    if (e.name === "TokenExpiredError") {
      return res.status(401).json({ error: true,
        message: "JWT token has expired" });
    } else {
      return res.status(401).json({ error: true,
        message: "Invalid JWT token" });
    }
  }
})

// router.post('/logout')  -- needs cleaning + error handling
router.post('/logout', (req, res) => {
  const token = req.body.refreshToken;
  // const oldHashRrfresh = crypto.createHash('sha256').update(token).digest('hex')

  if (!token) {
    return res.status(400).json({ error: true,
      message: "Request body incomplete, refresh token required"
    });
  }

  try {
    jwt.verify(token, process.env.JWT_SECRET);

    // req.db.from("users").where("refreshToken", "=", oldHashRrfresh).update({ bearerToken: '', refreshToken: '' })
      // .then(() => {
        return res.status(200).json({
          "error": false,
          "message": "Token successfully invalidated"
        // });
  });
  } catch (e) {
    if (e.name === "TokenExpiredError") {
      return res.status(401).json({ error: true, message: "JWT token has expired" });
    } else {
      return res.status(401).json({ error: true, message: "Invalid JWT token" });
    }
  }
})

// router.get('/:email/profile')  -- needs cleaning + error handling
router.get('/:email/profile', (req, res) => {

  let email = req.params.email;
  const bearer = req.headers['authorization'];

  req.db
    .from("users")
    .select("firstName",
      "lastName",
      "dob",
      "email",
      "address"
    )
    .where("email", email)
    .then((info) => {
      if ( info.length === 0 ) {
        return res.status(404).json({ error: true, message: "User not found" })
      }

      details = info[0]
      if (!bearer) {
        return res.status(200).json({ email: details.email,
          firstName: details.firstName,
          lastName: details.lastName })
      }

      const token = bearer.split(' ');

      if (token.length !== 2 || token[0] !== 'Bearer') {
        return res.status(401).json({ error: true,
          message: "Authorization header is malformed" })
      }

      const tokenValue = token[1];

      try {
        jwt.verify(tokenValue, process.env.JWT_SECRET);
        //check db for stored token
        return res.status(200).json({ email: details.email,
          firstName: details.firstName,
          lastName: details.lastName,
          dob: details.dob,
          address: details.address })
      } catch (e) {
        if (e.name === "TokenExpiredError") {
          res.status(401).json({ error: true,
            message: "JWT token has expired" });
        } else {
          res.status(401).json({ error: true,
            message: "Invalid JWT token" });
        }
        return;
      }
    });
});


// router.put('/:email/profile')  -- needs cleaning + error handling
router.put('/:email/profile', authorization, (req, res) => {
  let email = req.params.email;
  const bearer = req.headers['authorization'];

  const firstName = req.body.firstName;
  const lastName = req.body.lastName;
  const dob = req.body.dob;
  const address = req.body.address;

  if (!firstName || !lastName || ! dob || ! address) {
    return res.status(400).json({ error: true, 
      message: "Request body incomplete: firstName, lastName, dob and address are required."
    })
  }

  if (typeof(firstName) !== 'string' || typeof(lastName) !== 'string'
      || typeof(dob) !== 'string' || typeof(address) !== 'string') {
        return res.status(400).json({ error: true,
          message: "Request body invalid: firstName, lastName and address must be strings only."
        })
      }

  if (!isValidDOB(req.body.dob)) {
    return res.status(400).json({
      error: true,
      message: "Invalid input: dob must be a real date in format YYYY-MM-DD."
    });
  }

  if (!isPastDOB(req.body.dob)) {
    return res.status(400).json({
      error: true,
      message: "Invalid input: dob must be a date in the past."
    });
  }

  // check if the token is theirs and send 403

  req.db.from("users").where("email", "=", email).update({ firstName: firstName, lastName: lastName, dob: dob, address: address })
    .then(() => {
      return res.status(200).json({
        email: email,
        firstName: firstName,
        lastName: lastName,
        dob: dob,
        address: address
      });
    })
    .catch(err => {
      console.error("server error", err);
      return res.status(500).json({
        error: true,
        message: "Internal server error"
      });
    });
});

module.exports = router;
