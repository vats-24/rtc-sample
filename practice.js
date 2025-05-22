const os = require("os");
const path = require("path");
console.log(path.join(process.cwd(), "media"));
console.log(os.cpus().length);
