var http = require('http');
var cheerio = require('cheerio');
const { resolve } = require('path');

function getCategory() {
    return new Promise((resolve, reject) => {
        let url = 'http://www.pmtcgo.com/database';
        http.get(url, function (res) {
            var html = '';
            res.setEncoding('utf-8'); //防止中文乱码
            res.on('data', function (chunk) {
                html += chunk;
            });
            res.on('end', function () {
                var $ = cheerio.load(html); //采用cheerio模块解析html 
                let category = $('.custom-checkbox').find('input').map((i, el) => $(el).attr('value')).get()
                    .filter((k, v) => /[A-Za-z]+/u.test(k));
                resolve(category);
            })
        })
    })
};

getCategory().then((r) => {
    var mysql = require('mysql');
    const DATABASE = 'ptcg';
    const TABLE = 'CATEGORY';
    var client = mysql.createConnection({
        user: 'root',
        password: 'Kirito123'
    });
    client.connect();
    const createTblSql = `CREATE TABLE IF NOT EXISTS ${TABLE} ( name VARCHAR(20) NOT NULL )ENGINE=InnoDB DEFAULT CHARSET=utf8;`
    client.query("use " + DATABASE);
    client.query(createTblSql);
    client.query("truncate table " + TABLE);
    let fn = r.map(k => {
        return new Promise((resolve) => {
            client.query(
                'SELECT * FROM ' + TABLE,
                (err, results, fields) => {
                    if (err) {
                        throw err;
                    }
                    if (results) {
                        var userAddSql = `INSERT INTO  ${TABLE} SET ?`;
                        client.query(userAddSql, { name: k }, function (err, result) {
                            if (err) {
                                console.log('[INSERT ERROR] - ', err.message);
                                return;
                            }
                            console.log('-------INSERT----------');
                            console.log('INSERT ID:', result);
                            console.log('#######################');
                        });
                    }
                    resolve()
                }
            );
        })

    });
    Promise.all(fn).then(() => { client.end(); });

});