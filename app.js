// DB接続の確認 将来的には外だし
const mysql = require("mysql2"); 
// MySQL接続 本来はuser,passwordなどはコードに記載しない
const connection = mysql.createConnection({
  host: 'mysql',
  user: 'root', // ユーザがrootだとなんでもできるのでよくない
  password: 'mysqlpass', // パスワード記載は特にやばい
  database: 'store'
});
// 接続確認(起動時にメッセージ出す)
connection.connect((error) => {
  if (error) console.error("DB(MySQL)接続 *** エラー ***:", error);
  else console.log("DB(MySQL) 接続確認 === 成功 ===");
});




// app.js (CommonJS / Node.js 22 対応)
const express = require("express");

// appを定義
const app = express();

// body parser
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// cssやjsファイルは、publicの中身を返す 
app.use(express.static("public"));



// VSCodeローカルテスト時(/proxy/3000/が付与)対応のため追記
require('dotenv').config();
const BASE_PATH = process.env.BASE_PATH || '';
app.use((req, res, next)=>{
  res.locals.basePath = BASE_PATH;
  next();
});


/*
 * トップ：商品一覧
 */
app.get("/", (req, res) => {

  let errorMessage = "";

  connection.query(
    "SELECT * FROM products ORDER BY id DESC", 
    (error, results) => {
      if (error) errorMessage = error.message;
      res.render("index.ejs", { products: results || [], errorMessage });
    }
  );
});

/*
 * 発注完了 /:id より先に置かないと、:idに吸い込まれる
 */
app.get("/thanks", (req, res) => {
  res.render("thanks.ejs");
});
/*
 * 管理画面 /:id より先に置かないと、:idに吸い込まれる
 */
app.get("/admin", (req, res)=>{
  res.redirect("/admin/products");
});

/*
 * 商品詳細
 */
app.get("/:id", (req, res) => {
  let errorMessage = "";
  const id = req.params.id;

  connection.query("SELECT * FROM products WHERE id = ?", 
    [id], 
    (error, results) => {
      if (error) errorMessage = error.message;
      else if (!results || results.length === 0) errorMessage = "商品が見つかりませんでした";
      res.render("detail.ejs", 
        { product: (results && results[0]) || {}, errorMessage }
      );
    }
  );
});

/*
 * 注文
 */
app.post("/order", (req, res) => {
  const product_id = req.body.product_id;
  const quantity = 1;

  connection.query(
    // 商品の在庫数を減らす
    "UPDATE products SET stock = stock - ? WHERE id = ? AND stock >= ?", 
    [quantity, product_id, quantity], 
    (error, result) => {
      if(error){
        // DBでの接続などのエラー
        console.log("UPDATE error:", error);
        return res.render("error.ejs", {
          errorMessage: error.message,
          link_url: `/${product_id}`,
          page_name: "商品ページ",
        });
      }
      // 以下、DBアクセスでエラーが起きなければ
      // 該当の結果がない(在庫なし)、もしくは、affectedRowsが1でない場合
      //　affectedRows は「条件に一致して実際に処理された行数（例：書き込み試行が行われた行）」
      if(!result || result.affectedRows !==1){
        return res.render("error.ejs",{
          errorMessage: "在庫が不足しているか、商品が見つかりません",
          link_url: `/${product_id}`,
          page_name: "商品ページ",
        });
      }

      // 注文データ作成
      connection.query(
        "INSERT INTO orders (product_id, quantity) VALUES (?, ?)", 
        [product_id, quantity], 
        (error) => {
          if (error) { 
            console.error("INSERT order error:", error);
            return res.render("error.ejs", { 
              errorMessage: error.message, 
              link_url: `/${product_id}`, 
              page_name: "商品ページ", 
            });
          }
          // 成功したらサンクスへ
          console.log('購入成功');
          res.redirect("thanks");
        }
      );
    }
  )

  /** トランザクション処理
  // 1) トランザクション開始
  connection.beginTransaction((error) => {
    if (error) { return res.render("error.ejs", { errorMessage: error.message, link_url: `${product_id}`, page_name: "商品ページ", }); }
    // 2) 在庫確認（FOR UPDATEでロック）
    connection.query( "SELECT id, stock FROM products WHERE id = ? FOR UPDATE",[product_id], (error, results) => { 
      if (error) { return connection.rollback(() => { res.render("error.ejs", { errorMessage: error.message, link_url: `/${product_id}`, page_name: "商品ページ", });}); }
      if (!results || results.length === 0) { return connection.rollback(() => { res.render("error.ejs", { errorMessage: "商品が見つかりませんでした", link_url: `/${product_id}`, page_name: "商品ページ", }); }); }
      if (results[0].stock < quantity) { return connection.rollback(() => { res.render("error.ejs", { errorMessage: "在庫が不足しています", link_url: `/${product_id}`, page_name: "商品ページ", }); }); }
      // 3) 在庫減算
      connection.query( 
        "UPDATE products SET stock = stock - ? WHERE id = ?", [quantity, product_id], (error, updateResult) => { 
          if (error || !updateResult || updateResult.affectedRows !== 1) { return connection.rollback(() => { res.render("error.ejs", { errorMessage: error ? error.message : "在庫更新に失敗しました", link_url: `/${product_id}`, page_name: "商品ページ", }); }); }
          // 4) 注文作成
          connection.query(
            "INSERT INTO orders (product_id, quantity, order_date) VALUES (?, ?, NOW())", [product_id, quantity], (error) => {
              if (error) {return connection.rollback(() => { res.render("error.ejs", { errorMessage: error.message, link_url: `/${product_id}`, page_name: "商品ページ", }); });}
              // 5) コミット
              connection.commit((error) => {
                if (error) { return connection.rollback(() => { res.render("error.ejs", { errorMessage: error.message, link_url: `/${product_id}`, page_name: "商品ページ", }); }); }
                // 成功したらサンクスへ
                console.log('購入成功！');
                res.redirect("/thanks");
              });
            }
          );
        }
      );
    });
  });
  **/

});




/*
 * 管理画面（学習用：空実装）
 */
app.get("/admin/products", (req, res) => {
  res.render("admin/products/index.ejs", { products: [], errorMessage: "" });
});

app.get("/admin/products/new", (req, res) => {
  res.render("admin/products/new.ejs", { errorMessage: "" });
});

app.get("/admin/products/edit", (req, res)=>{
  res.render("admin/products/edit.ejs", { errorMessage: ""});
});

app.get("/admin/orders", (req, res)=>{
  res.render("admin/orders/index.ejs", { errorMessage: "仮エラー"});
});

app.get("/admin/orders/show", (req, res)=>{
  res.render("admin/orders/show.ejs", 
    { order: {
        id:"999",
        quantity: "1",
        price: "1500",
        name:"製品名です",
        image_url: "https://placehold.jp/79b74a/ffffff/400x400.png?text=*image*%0AUntitled"
      }});
});

/*
 * 起動
 */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("TCPポート" + PORT + "番にてNode.jsサーバ稼働開始");
});

module.exports = app;
