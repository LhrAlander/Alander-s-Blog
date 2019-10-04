import * as express from 'express'
import * as fs from 'fs'
import * as path from 'path'
import * as Markdown from 'markdown-it'
import * as hljs from 'highlight.js'

const md = Markdown({
	highlight(str, lang) {
		if (lang && hljs.getLanguage(lang)) {
			try {
				let value = hljs.highlight(lang, str).value
				let lineNumber = `<div class="line-numbers-wrapper">`
				for (let i = 1, l = value.split('\n').length; i < l; i++) {
					lineNumber += `<span class="line-number">${i}</span>`
				}
				lineNumber += `</div>`
				console.log(lineNumber)
				return lineNumber + value
			} catch (__) { }
		}

		return '' // use external default escaping
	}
})

const app = express()

app.use(express.static('static'))

app.set('views', './views')
app.set('view engine', 'pug')

app.get('/', (_req, res) => {
	res.render('index')
})

app.get('/test', (_req, res) => {
	fs.readFile(path.resolve(__dirname, './source/test.md'), { encoding: 'utf8' }, (err, data) => {
		if (err) {
			res.end('error')
		} else {
			const html = md.render(data)
			res.render('blog', { data: html, title: '你好，世界', date: '2019/10/04' })
		}
	})
})

app.listen(3000, () => {
	console.log('Example app listening on port 3000!')
})