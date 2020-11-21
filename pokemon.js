var http = require('http');
var cheerio = require('cheerio');
// var url = "http://www.pmtcgo.com/";
const DATABASE = 'ptcg';
const POKEMON_TABLE = 'POKEMON_CARD_INFO';
const TRANIER_TABLE = 'TRAINER_CARD_INFO';
function startRequest(url) {
    return new Promise((resolve, reject) => {
        http.get(url, function (res) {
            var html = '';
            res.setEncoding('utf-8'); //防止中文乱码
            res.on('data', function (chunk) {
                html += chunk;
            });
            res.on('end', function () {

                var $ = cheerio.load(html); //采用cheerio模块解析html

                let type = $('.hp').parent().find('i').attr('class');
                let jumbotron = $('.rwbox').map((i, el) => {
                    return {
                        type: $(el).find('i').attr('class') && $(el).find('i').attr('class').slice(14).trim(),
                        number: $(el).text().trim()
                    }
                }).get();
                const cardContent = $('.card-content').find('.left').find('label').text().trim()
                let news_item = {
                    name: cardContent.indexOf('训练师卡') !== -1 ? $('.card-header').text().trim() : $('.pokemon-icon').parent().text().trim(),
                    hp: $('.hp').text().trim(),
                    attribute: {
                        cardContent: cardContent,
                        from: $('.card-content').find('.left').find('div').text().trim()
                    },
                    type: type && type.slice(14).trim(),
                    abilitys: $('.abilitys').find('.card').map((i, el) => {
                        let cardHeader = $(el).find('.card-header').text().trim();
                        cardHeader = cardHeader && cardHeader.split('\n');
                        return {
                            skill: cardHeader[0] && cardHeader[0].trim(),
                            content: $(el).find('.card-body').text().trim()
                        }
                    }).get(),
                    power: $('.power').find('.card').map((i, el) => {
                        let cardHeader = $(el).find('.card-header').text().trim();
                        cardHeader = cardHeader && cardHeader.split('\n');
                        return {
                            cost: $(el).find('.cost').find('i').map((l, sel) => $(sel).attr('class') && $(sel).attr('class').slice(14).trim()).get().join(','),
                            skill: cardHeader[0] && cardHeader[0].trim(),
                            damage: cardHeader[1] && cardHeader[1].trim(),
                            content: $(el).find('.card-body').text().trim()
                        }
                    }).get(),
                    weakness: jumbotron[0],
                    resistance: jumbotron[1],
                    escape: $('.energy-list').find('i').length,
                    img: $('.card-image').find('img').attr('src')

                }
                resolve(news_item)
            });
        }).on('error', function (err) {
            console.log(err)
        });
    })

}

const getTrainerType = (cardContent) => {
    if (cardContent.indexOf('支援卡') !== -1) {
        return 'support'
    }
    if (cardContent.indexOf('宝可梦道具卡') !== -1) {
        return 'item'
    }
    if (cardContent.indexOf('训练场地卡') !== -1) {
        return 'stadium'
    }
    return null;
}


async function insertDB(url, client, category) {
    for (var i = 1; i < 250; i++) {
        let n = await startRequest(`${url}${i}`);
        if (n.hp !== '') {
            client.query(
                'SELECT * FROM ' + POKEMON_TABLE,
                (err, results) => {
                    if (err) {
                        throw err;
                    }
                    if (results) {
                        var userAddSql = `INSERT INTO  ${POKEMON_TABLE} SET ?`;
                        client.query(userAddSql, {
                            pid: `${category}_${i - 1}`,
                            category: category,
                            name: n.name,
                            hp: n.hp,
                            p_type: n.type,
                            abilitys: n.abilitys.length > 0 ? n.abilitys.map(k => JSON.stringify(k)).join(',') : null,
                            power: n.power.length > 0 ? n.power.map(k => JSON.stringify(k)).join(',') : null,
                            weakness_type: n.weakness && n.weakness.type,
                            resistance_type: n.resistance && n.resistance.type,
                            weakness_number: n.weakness && n.weakness.number,
                            resistance_number: n.resistance && n.resistance.number,
                            escape: n.escape,
                            img: n.img
                        },
                            function (err, result) {
                                if (err) {
                                    console.log('[INSERT ERROR] - ', err.message);
                                    return;
                                }
                                console.log('-------INSERT----------');
                                console.log('INSERT ID:', result.insertId);
                                console.log('#######################');
                            });
                    }
                }
            );
        } else if (n.attribute.cardContent.indexOf('训练师卡') !== -1) {
            const cardContent = n.attribute.cardContent;
            client.query(
                'SELECT * FROM ' + TRANIER_TABLE,
                (err, results) => {
                    if (err) {
                        throw err;
                    }
                    if (results) {
                        var userAddSql = `INSERT INTO  ${TRANIER_TABLE} SET ?`;
                        client.query(userAddSql, {
                            tid: `${category}_${i - 1}`,
                            category: category,
                            name: n.name,
                            t_type: getTrainerType(cardContent),
                            effect: n.power[0].content,
                            img: n.img
                        },
                            function (err, result) {
                                if (err) {
                                    console.log('[INSERT ERROR] - ', err.message);
                                    return;
                                }
                                console.log('-------INSERT----------');
                                console.log('INSERT ID:', result.insertId);
                                console.log('#######################');
                            });
                    }
                }
            );
        }
    }
}

function start() {
    var mysql = require('mysql');

    var client = mysql.createConnection({
        user: 'root',
        password: 'Kirito123',
        // connectionLimit: 50
    });
    client.connect();

    const createPokemonTblSql = `CREATE TABLE IF NOT EXISTS ${POKEMON_TABLE} (` +
        `id INT UNSIGNED AUTO_INCREMENT,` +
        `pid VARCHAR(20) NOT NULL ,` +
        `category VARCHAR(20),` +
        `name VARCHAR(20) NOT NULL ,` +
        `hp SMALLINT NOT NULL ,` +
        `p_type VARCHAR(20) NOT NULL,` +
        `abilitys VARCHAR(1024),` +
        `power VARCHAR(1024),` +
        `weakness_type VARCHAR(20),` +
        `resistance_type VARCHAR(20),` +
        `weakness_number VARCHAR(20),` +
        `resistance_number VARCHAR(20),` +
        `escape SMALLINT,` +
        `img VARCHAR(250),` +
        `PRIMARY KEY (id)` +
        `)ENGINE=InnoDB DEFAULT CHARSET=utf8;`
    const createTrainerTblSql = `CREATE TABLE IF NOT EXISTS ${TRANIER_TABLE} (` +
        `id INT UNSIGNED AUTO_INCREMENT,` +
        `tid VARCHAR(20) NOT NULL ,` +
        `category VARCHAR(20),` +
        `name VARCHAR(20) NOT NULL ,` +
        `t_type VARCHAR(20),` +
        `effect VARCHAR(1024),` +
        `img VARCHAR(250),` +
        `PRIMARY KEY (id)` +
        `)ENGINE=InnoDB DEFAULT CHARSET=utf8;`
    client.query("use " + DATABASE);
    client.query(createPokemonTblSql);
    client.query(createTrainerTblSql);
    client.query("truncate table " + POKEMON_TABLE);
    client.query("truncate table " + TRANIER_TABLE);
    console.log('连接数据库成功')
    client.query('select name AS solution from category;', async function (error, results, fields) {
        if (error) throw error;
        let urlList = results.map(k => {
            return {
                url: `http://www.pmtcgo.com/card/${k.solution}`,
                category: k.solution
            }
        })
        console.log('获取链接成功')
        async function insertPokemon() {
            for (let item of urlList) {
                let url = `${item.url}_`
                if (item.url.indexOf('SWSHP') !== -1) {
                    url = `${item.url}_SWSH`
                }
                if (item.url.indexOf('SMA') !== -1) {
                    url = `${item.url}_SV`
                }
                if (item.url.indexOf('SMP') !== -1) {
                    url = `${item.url}_SM`
                }
                if (item.url.indexOf('DC') !== -1) {
                    url = `${item.url}1_`
                }
                if (item.url.indexOf('XYP') !== -1) {
                    url = `${item.url}_XY`
                }
                if (item.url.indexOf('DV') !== -1) {
                    url = `${item.url}1_`
                }
                if (item.url.indexOf('BWP') !== -1) {
                    url = `${item.url}_BW`
                }
                console.log(`INSERT ${item.category} 开始`)
                await insertDB(url, client, item.category);
                console.log(`INSERT ${item.category} 结束`)
            }
        }
        await insertPokemon();
        console.log('INSERT 结束')
        client.end();
    });
}

start()
