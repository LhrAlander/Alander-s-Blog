#!/usr/bin/env node

'use strict';
const inquirer = require('inquirer');
const autocomplete = require('inquirer-autocomplete-prompt')
const fs = require('fs')
const path = require('path')
const hljs = require('highlight.js')
const Markdown = require('markdown-it')
const pug = require('pug')

inquirer.registerPrompt('autocomplete', autocomplete);

const articleDir = fs.readdirSync(path.resolve(__dirname, 'source'))
const htmlDirs = fs.readdirSync(path.resolve(__dirname, 'static/blogs'))

const mapHtml = (function () {
  return htmlDirs.reduce((obj, dirName) => {
    try {
      const jsonFile = fs.readFileSync(path.resolve(__dirname, `./static/blogs/${dirName}/info.json`))
      if (jsonFile) {
        const info = JSON.parse(jsonFile.toString())
        obj[info.article] = info
      }
      return obj
    } catch (error) {
      return obj
    }
  }, {})
})()

function searchArticle(answers, input) {
  return new Promise((resolve) => {
    resolve(input ? articleDir.filter(_ => _.includes(input)) : articleDir)
  })
}

const md = Markdown({
  highlight(str, lang) {
    if (lang && hljs.getLanguage(lang)) {
      try {
        let value = hljs.highlight(lang, str).value
        return value
      } catch (__) { }
    }

    return '' // use external default escaping
  },
  html: true
})

function writeToHtml(answers) {
  const data = fs.readFileSync(path.resolve(__dirname, `./source/${answers.article}`), { encoding: 'utf8' })
  if (data) {
    const html = md.render(data)
    const string = pug.renderFile(path.resolve(__dirname, './views/blog.pug'), { data: html, title: answers.title, date: answers.createTime })
    const dirPath = path.resolve(__dirname, `./static/blogs/${answers.fileName}`)
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath)
    }
    fs.writeFileSync(path.resolve(dirPath, 'index.html'), string)
    fs.writeFileSync(path.resolve(dirPath, `info.json`), JSON.stringify(answers))
  }
}

function addNewHtml(answers) {
  console.log('add')
  try {
    answers.createTime = new Date().toLocaleDateString()
    answers.updateTime = answers.createTime
    writeToHtml(answers)
    console.log('add file successfully!')
  } catch (error) {
    console.error('something goes wrong', error)
  }
}

function editHtml(answers) {
  const info = mapHtml[answers.article]
  info.updateTime = new Date().toLocaleDateString()
  try {
    writeToHtml(info)
    console.log('edit file successfully!')
  } catch (error) {
    console.error(error)
  }
}

let questions = [{
  type: 'autocomplete',
  name: 'article',
  message: 'The name of the article which is going to be operated',
  source: searchArticle,
  pageSize: 4,
  suggestOnly: true,
  validate: function (val) {
    return val ? true : 'Type something!';
  },
},
{
  type: 'expand',
  name: 'mode',
  message: 'What operate will be done with the article?',
  choices: [{
    key: 'a',
    name: 'add a new html file with the markdown article',
    value: 'add'
  },
  {
    key: 'r',
    name: 'rebuild the html file from the markdown article',
    value: 'rebuild'
  }
  ]
},
{
  type: 'input',
  name: 'fileName',
  message: "what's them html file's name?",
  default: function (answers) {
    if (answers.mode === 'add') {
      return ``
    }
    return mapHtml[answers.article].fileName
  },
  validate: function (value) {
    if (value) {
      return true;
    }
    return 'please enter a name for html file'
  }
},
{
  type: 'input',
  name: 'title',
  message: "what's the html file's title?",
  default: function (answers) {
    if (answers.mode === 'add') {
      return ``
    }
    return mapHtml[answers.article].title
  },
  validate: function (value) {
    if (value) {
      return true;
    }
    return 'please enter a title for html file'
  }
}
]

inquirer.prompt(questions).then(answers => {
  console.log(answers)
  if (answers.mode === 'add') {
    addNewHtml(answers)
  } else {
    editHtml(answers)
  }
});