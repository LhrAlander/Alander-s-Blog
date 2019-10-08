import * as express from 'express'
import * as fs from 'fs'
import * as path from 'path'
const dayjs = require('dayjs');

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
		const res = JSON.parse(fs.readFileSync(jsonPath, { encoding: 'utf8' }))
		res.createTime = dayjs(res.createTime).format('YYYY-MM-DD');
		res.updateTime = dayjs(res.updateTime).format('YYYY-MM-DD');
		return res;
	}).sort((a, b) => {
		return dayjs(a.createTime).isAfter(b.createTime) ? -1 : 1;
	})
	res.render('posts', { articles })
})

app.get('/timeline', (_req, res) => {
	const items = JSON.parse(fs.readFileSync(path.resolve(__dirname, './timeline.json'), { encoding: 'utf8' }))
	const order = Object.keys(items).sort((a, b) => a > b ? -1 : 1)
	res.render('timeline', { items, order })
})

app.listen(3000, () => {
	console.log('Example app listening on port 3000!')
})
