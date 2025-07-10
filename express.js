require('dotenv').config();
const express = require('express');
const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');

const { SlashCommandBuilder, AttachmentBuilder } = require('discord.js');
const JavaScriptObfuscator = require('javascript-obfuscator');
const terser = require('terser');
const beautify = require('js-beautify').js;
const minify_html = require('html-minifier').minify;
const CleanCSS = require('clean-css');

const app = express();
const PORT = process.env.PORT || 3000;
const VALID_API_KEY = process.env.API_KEY;

// Endpoint dasar
app.get('/', (req, res) => {
  res.send('📘 Gunakan endpoint /code dengan header x-api-key untuk melihat kode.');
});

// Endpoint untuk ambil isi obfuscator command jika API Key valid
app.get('/code', async (req, res) => {
  const key = req.headers['x-api-key'];
  if (!key) return res.status(400).send('❌ API Key diperlukan di header (x-api-key)');
  if (key !== VALID_API_KEY) return res.status(403).send('❌ API Key tidak valid');

  console.log('✅ API Key valid digunakan');

  const obfCode = `
const { SlashCommandBuilder, AttachmentBuilder } = require('discord.js');
const JavaScriptObfuscator = require('javascript-obfuscator');
const terser = require('terser');
const beautify = require('js-beautify').js;
const minify_html = require('html-minifier').minify;
const CleanCSS = require('clean-css');
const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('obf')
    .setDescription('Obfuscate or minify source code (JS, HTML, CSS, JSON)')
    .addStringOption(option =>
      option.setName('code')
        .setDescription('Paste the code here (optional if uploading a file)')
        .setRequired(false))
    .addAttachmentOption(option =>
      option.setName('file')
        .setDescription('Upload a code file (.js, .json, .html, .css)')
        .setRequired(false)),
  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const codeInput = interaction.options.getString('code');
    const file = interaction.options.getAttachment('file');

    if (!codeInput && !file) {
      return interaction.editReply('❌ You must provide either a code snippet using the \`code\` option or upload a file using the \`file\` option.\\n\\n**Example usage:**\\n- \`/obf code: console.log("Hello")\`\\n- \`/obf file: myscript.js\`');
    }

    let code = codeInput;
    let ext = '.js';

    if (file) {
      const allowed = ['.js', '.json', '.html', '.css'];
      ext = path.extname(file.name).toLowerCase();
      if (!allowed.includes(ext)) {
        return interaction.editReply(\`❌ Unsupported file type: \\\`\${ext}\\\`\`);
      }
      const response = await fetch(file.url);
      code = await response.text();
    }

    let result;
    try {
      switch (ext) {
        case '.js': {
          const minified = await terser.minify(code);
          if (minified.error) throw minified.error;
          result = JavaScriptObfuscator.obfuscate(minified.code, {
            compact: true,
            controlFlowFlattening: true,
            controlFlowFlatteningThreshold: 0.75,
            numbersToExpressions: true,
            simplify: true,
            stringArrayShuffle: true,
            stringArray: true,
            stringArrayThreshold: 0.75
          }).getObfuscatedCode();
          break;
        }
        case '.json': {
          const json = JSON.parse(code);
          result = JSON.stringify(json);
          break;
        }
        case '.html': {
          result = minify_html(code, {
            collapseWhitespace: true,
            removeComments: true,
            minifyCSS: true,
            minifyJS: true
          });
          break;
        }
        case '.css': {
          result = new CleanCSS().minify(code).styles;
          break;
        }
        default:
          return interaction.editReply('❌ Unsupported file type.');
      }
    } catch (err) {
      return interaction.editReply(\`❌ Failed to process code:\\n\\\`\\\`\\\`\\n\${err.message}\\n\\\`\\\`\\\`\`);
    }

    if (result.length > 1900) {
      const tempPath = \`./output-\${Date.now()}\${ext}\`;
      fs.writeFileSync(tempPath, result);
      const fileAttach = new AttachmentBuilder(tempPath, { name: \`obfuscated\${ext}\` });
      await interaction.editReply({ content: \`✅ Done.\`, files: [fileAttach] });
      fs.unlinkSync(tempPath);
    } else {
      await interaction.editReply(\`✅ Processed code:\\n\\\`\\\`\\\`\${ext.replace('.', '')}\\n\${result}\\n\\\`\\\`\\\`\`);
    }
  }
};
  `;

  res.type('text/plain').send(obfCode);
});

app.listen(PORT, () => {
  console.log(`🚀 Server aktif di http://localhost:${PORT}`);
});
