import express from "express";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { pool } from "./db/db.js";

dotenv.config();

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// __dirnameの代替を設定
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ビューエンジンの設定
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");

app.use(express.static(path.join(__dirname, "public")));

// ECサイトのルーティング
app.get("/", (req, res) => {
    let errorMessage = "";

    pool.query("SELECT * FROM products ORDER BY id DESC", (error, results) => {
        if (error) errorMessage = error.message;
        res.render("index.ejs", { products: results || [], errorMessage });
    });

});

app.get("/thanks", (req, res) => {
    res.render("thanks.ejs");
});

app.get("/:id", (req, res) => {
    let errorMessage = "";
    const id = req.params.id;

    pool.query("SELECT * FROM products WHERE id = ?", [id], (error, results)=>{
        if(error) errorMessage = error.message;
        else if (!results || results.length === 0) errorMessage = "商品が見つかりませんでした";

        res.render("detail.ejs", { product: (results && results[0]) || {}, errorMessage });
    });
});

app.post("/order", (req, res) => {
  const product_id = req.body.product_id;
  const quantity = 1;

  pool.getConnection((error, connection) => {
    if (error) {
      return res.render("error.ejs", {
        errorMessage: error.message,
        link_url: `/${product_id}`,
        page_name: "商品ページ",
      });
    }

    const releaseWith = (fn) => (arg) => { connection.release(); fn(arg); };

    connection.beginTransaction((error) => {
      if (error) return releaseWith(resError)(error);

      // 1) ロックして在庫確認
      connection.query(
        "SELECT id, stock FROM products WHERE id = ? FOR UPDATE",
        [product_id],
        (error, results) => {
          if (error) return rollback(error);
          if (!results || results.length === 0) return rollback(new Error("商品が見つかりませんでした"));
          if (results[0].stock < quantity) return rollback(new Error("在庫が不足しています"));

          // 2) 在庫減算
          connection.query(
            "UPDATE products SET stock = stock - ? WHERE id = ?",
            [quantity, product_id],
            (error, result) => {
              if (error) return rollback(error);
              if (result.affectedRows !== 1) return rollback(new Error("在庫更新に失敗しました"));

              // 3) 注文作成
              connection.query(
                "INSERT INTO orders (product_id, quantity, order_date) VALUES (?, ?, NOW())",
                [product_id, quantity],
                (error) => {
                  if (error) return rollback(error);

                  // 4) コミット
                  connection.commit((error) => {
                    if (error) return rollback(error);
                    connection.release();
                    res.redirect("/thanks");
                  });
                }
              );
            }
          );
        }
      );
    });

    function rollback(error) {
      connection.rollback(() => {
        connection.release();
        res.render("error.ejs", {
          errorMessage: error.message,
          link_url: `/${product_id}`,
          page_name: "商品ページ",
        });
      });
    }

    function resError(error) {
      res.render("error.ejs", {
        errorMessage: error.message,
        link_url: `/${product_id}`,
        page_name: "商品ページ",
      });
    }
  });
});

// 商品管理画面のルーティング
app.get("/admin/products", (req, res) => {



});

app.get("/admin/products/new", (req, res) => {
    


});

app.post("/admin/products/create", (req, res) => {
  const { name, price, image_url, stock, description } = req.body;
  const params = [
    name,
    price === "" ? null : price,
    image_url === "" ? null : image_url,
    stock === "" ? null : stock,
    description === "" ? null : description,
  ];

  pool.query(
    `INSERT INTO products (name, price, image_url, stock, description, created_at)
     VALUES (?, ?, ?, ?, ?, NOW())`,
    params,
    (error) => {
      if (error) {
        return res.render("error.ejs", {
          errorMessage: error.message,
          link_url: "/admin/products/new",
          page_name: "商品追加ページ",
        });
      }
      res.redirect("/admin/products");
    }
  );
});

app.get("/admin/products/edit/:id", (req, res) => {
    let errorMessage;
    let products;

    try {

    } catch (error) {

    }

    
});

app.post("/admin/products/update/:id", (req, res) => {
  const id = req.params.id;
  const { name, price, image_url, stock, description } = req.body;

  const params = [
    name,
    price === "" ? null : price,
    image_url === "" ? null : image_url,
    stock === "" ? null : stock,
    description === "" ? null : description,
    id,
  ];

  pool.query(
    `UPDATE products
       SET name = ?, price = ?, image_url = ?, stock = ?, description = ?
     WHERE id = ?`,
    params,
    (error, result) => {
      if (error) {
        return res.render("error.ejs", {
          errorMessage: error.message,
          link_url: `/admin/products/edit/${id}`,
          page_name: "商品更新ページ",
        });
      }
      if (!result || result.affectedRows !== 1) {
        return res.render("error.ejs", {
          errorMessage: "更新対象が見つかりません",
          link_url: `/admin/products/edit/${id}`,
          page_name: "商品更新ページ",
        });
      }
      res.redirect("/admin/products");
    }
  );
});


// 注文管理画面のルーティング
app.get("/admin/orders", (req, res) => {
    let errorMessage;
    let orders;


});

app.get("/admin/orders/:id", (req, res) => {
    let errorMessage;
    let order;

});

app.listen(3000);

export default app;
