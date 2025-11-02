const jwt = require("jsonwebtoken");

function signJwt(payload, opts = {}) {
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: "7d", ...opts });
}
function verifyJwt(token) {
  return jwt.verify(token, process.env.JWT_SECRET);
}

module.exports = { signJwt, verifyJwt };
