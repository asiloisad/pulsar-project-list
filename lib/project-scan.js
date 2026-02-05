const { globSync } = require("glob");

process.on("message", (props) => {
  const entries = globSync(props.scanList, {
    cwd: props.dirPath,
    absolute: false,
  });
  process.send(entries);
  process.exit(0);
});
