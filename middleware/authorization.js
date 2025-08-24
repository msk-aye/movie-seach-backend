const jwt = require('jsonwebtoken');

module.exports = function (req, res, next) {
  // console.log(req.headers);
  const bearer = req.headers['authorization'];
  // console.log(bearer);

  if (!bearer) {
    return res.status(401).json({ error: true,
      message: "Authorization header ('Bearer token') not found" });
  }

  const token = bearer.split(' ');
  // console.log(token);

  if (token.length !== 2 || token[0] !== 'Bearer') {  // or next if
    return res.status(401).json({ error: true,
      message: "Authorization header ('Bearer token') not found" });
  }

  // if (token[0] !== 'Bearer') {
  //   return res.status(401).json({ error: true, message: "Authorization header ('Bearer token') not found" });
  // }

  const tokenValue = token[1];
  // console.log(tokenValue);

  try {
      jwt.verify(tokenValue, process.env.JWT_SECRET);
      // check token is in the db - requires that refresh, login and logout properly store tokens
  } catch (e) {
    if (e.name === "TokenExpiredError") {
      return res.status(401).json({ error: true, message: "JWT token has expired" });
    } else {
      return res.status(401).json({ error: true, message: "Invalid JWT token" });
    }
  }

  next();
}


// Tut code
// const jwt = require('jsonwebtoken');
// module.exports = function (req, res, next) {
//   if (!("authorization" in req.headers)
//     || !req.headers.authorization.match(/^Bearer /)
//   ) {
//     res.status(401).json({ error: true, message: "Authorization header ('Bearer token') not found" });
//     return;
//   }
//   const token = req.headers.authorization.replace(/^Bearer /, "");
//   try {
//     jwt.verify(token, process.env.JWT_SECRET);
//   } catch (e) {
//     if (e.name === "TokenExpiredError") {
//       res.status(401).json({ error: true, message: "JWT token has expired" });
//     } else {
//       res.status(401).json({ error: true, message: "Invalid JWT token" });
//     }
//     return;
//   }

//   next();
// };

