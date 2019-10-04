准备前后端不分离写个静态博客 + 博客发布系统
技术栈: Express + TypeScript + Pug + CSS

目前还在开发中，实验步骤：
> 1. 在根目录下新建source文件夹存放md文件
> 2. 在/source/下新建一个test.md
> 3. npm run dev
> 4. 访问 localhost:3000/test

后期计划工作
1. 完善文章页面
2. 编写cli快速创建文章并将文章自动从source/article.md转换为static/blogs/article.html
3. 分类，目前想法是在blogs/category/article.html进行区分
4. 打包完善
5. 杜绝数据库