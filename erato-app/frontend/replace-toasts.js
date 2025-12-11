// Helper script to replace Toast.show with showAlert
// This is just for reference - we'll do it manually

const replacements = [
  {
    pattern: /Toast\.show\(\s*{\s*type:\s*['"](success|error|info)['"],\s*text1:\s*['"]([^'"]+)['"],\s*text2:\s*['"]([^'"]+)['"],\s*visibilityTime:\s*\d+,\s*}\s*\)/g,
    replacement: (match, type, text1, text2) => 
      `showAlert({\n        title: '${text1}',\n        message: '${text2}',\n        type: '${type}',\n      })`
  },
  {
    pattern: /Toast\.show\(\s*{\s*type:\s*['"](success|error|info)['"],\s*text1:\s*['"]([^'"]+)['"],\s*text2:\s*([^,}]+),\s*visibilityTime:\s*\d+,\s*}\s*\)/g,
    replacement: (match, type, text1, text2) => 
      `showAlert({\n        title: '${text1}',\n        message: ${text2},\n        type: '${type}',\n      })`
  }
];

// This is just a reference - we'll do replacements manually
