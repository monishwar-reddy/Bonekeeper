const fs = require('fs');
const path = require('path');

const pluginContextPath = path.join(__dirname, '../node_modules/@netlify/plugin-nextjs/dist/build/plugin-context.js');
const serverFunctionsPath = path.join(__dirname, '../node_modules/@netlify/plugin-nextjs/dist/build/functions/server.js');

if (fs.existsSync(pluginContextPath)) {
  let content = fs.readFileSync(pluginContextPath, 'utf8');
  content = content.replace(
    'return join("/var/task", this.distDirParent);',
    'return posixJoin("/var/task", this.distDirParent.replaceAll("\\\\", "/"));'
  );
  content = content.replace(
    'return join(this.lambdaWorkingDirectory, ".netlify/dist/run/handlers/server.js");',
    'return posixJoin(this.lambdaWorkingDirectory.replaceAll("\\\\", "/"), ".netlify/dist/run/handlers/server.js");'
  );
  fs.writeFileSync(pluginContextPath, content, 'utf8');
  console.log('Patched @netlify/plugin-nextjs/dist/build/plugin-context.js for Windows path compatibility.');
}

if (fs.existsSync(serverFunctionsPath)) {
  let content = fs.readFileSync(serverFunctionsPath, 'utf8');
  content = content.replace(
    'templateVariables["{{cwd}}"] = posixJoin(ctx.lambdaWorkingDirectory);',
    'templateVariables["{{cwd}}"] = posixJoin(ctx.lambdaWorkingDirectory.replaceAll("\\\\", "/"));'
  );
  content = content.replace(
    'templateVariables["{{nextServerHandler}}"] = posixJoin(ctx.nextServerHandler);',
    'templateVariables["{{nextServerHandler}}"] = posixJoin(ctx.nextServerHandler.replaceAll("\\\\", "/"));'
  );
  fs.writeFileSync(serverFunctionsPath, content, 'utf8');
  console.log('Patched @netlify/plugin-nextjs/dist/build/functions/server.js for Windows path compatibility.');
}

// Also check and patch existing generated handler if present
const handlerPath = path.join(__dirname, '../packages/dashboard/.netlify/functions-internal/___netlify-server-handler/___netlify-server-handler.mjs');
if (fs.existsSync(handlerPath)) {
  let content = fs.readFileSync(handlerPath, 'utf8');
  content = content.replaceAll('\\var\\task', '/var/task');
  content = content.replaceAll('\\packages\\dashboard', '/packages/dashboard');
  content = content.replaceAll('\\.netlify\\dist\\run\\handlers\\server.js', '/.netlify/dist/run/handlers/server.js');
  fs.writeFileSync(handlerPath, content, 'utf8');
  console.log('Patched existing ___netlify-server-handler.mjs for Windows path compatibility.');
}
