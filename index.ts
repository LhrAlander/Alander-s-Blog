import * as express from 'express'
import * as fs from 'fs'
import * as path from 'path'

const app = express()

app.use(express.static('static'))

app.set('views', './views')
app.set('view engine', 'pug')

app.get('/about', (_req, res) => {
	res.render('about.pug')
})

app.get('/', (_req, res) => {
	let blogsDirPath = path.resolve(__dirname, './static/blogs')
	let blogs = fs.readdirSync(blogsDirPath)
	let articles = blogs.map(name => {
		let jsonPath = path.resolve(blogsDirPath, `./${name}/info.json`)
		return JSON.parse(fs.readFileSync(jsonPath, { encoding: 'utf8' }))
	})
	res.render('posts', { articles })
})

app.listen(3000, () => {
	console.log('Example app listening on port 3000!')
})
