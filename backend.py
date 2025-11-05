from flask import Flask, render_template, request, redirect, url_for, jsonify, send_file
import sqlite3
import datetime
import io
import pandas as pd
import os

APP_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(APP_DIR, 'store.db')
UPLOADS_DIR = os.path.join(APP_DIR, 'static', 'uploads')
ALLOWED_EXT = {'png','jpg','jpeg','gif','webp'}

app = Flask(__name__, static_folder='static', template_folder='templates')

# ---------- Database ----------
def get_conn():
    return sqlite3.connect(DB_PATH)

def init_db():
    conn = get_conn()
    cur = conn.cursor()
    cur.executescript('''
    CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        category TEXT,
        quantity INTEGER DEFAULT 0,
        price REAL DEFAULT 0,
        expiry_date TEXT,
        description TEXT,
        image TEXT,
        sold INTEGER DEFAULT 0
    );
    ''')
    conn.commit()
    conn.close()

    # ensure uploads dir exists
    os.makedirs(UPLOADS_DIR, exist_ok=True)

init_db()

# ---------- Helpers ----------
def rows_to_dicts(rows, cols):
    return [dict(zip(cols, r)) for r in rows]


def allowed_file(filename):
    if not filename:
        return False
    ext = filename.rsplit('.', 1)[-1].lower()
    return ext in ALLOWED_EXT


def save_uploaded_file(file_storage):
    # returns filename or None
    if not file_storage:
        return None
    filename = file_storage.filename
    if not allowed_file(filename):
        return None
    # sanitize filename: keep base name and timestamp
    base = os.path.basename(filename).replace(' ', '_')
    name, ext = os.path.splitext(base)
    ts = datetime.datetime.now().strftime('%Y%m%d%H%M%S')
    safe_name = f"{name}_{ts}{ext}"
    dest = os.path.join(UPLOADS_DIR, safe_name)
    file_storage.save(dest)
    return safe_name

# ---------- Pages ----------
@app.route('/')
def index():
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("SELECT COUNT(*) FROM products")
    total = cur.fetchone()[0]
    today = datetime.date.today().isoformat()
    cur.execute("SELECT COUNT(*) FROM products WHERE expiry_date IS NOT NULL AND expiry_date <> '' AND expiry_date < ?", (today,))
    expired = cur.fetchone()[0]
    cur.execute("SELECT COUNT(*) FROM products WHERE quantity <= 5")
    low_stock = cur.fetchone()[0]
    conn.close()
    return render_template('index.html', total=total, expired=expired, low_stock=low_stock)

@app.route('/add', methods=['GET','POST'])
def add_product():
    if request.method == 'POST':
        name = request.form.get('name','').strip()
        category = request.form.get('category','').strip()
        quantity = int(request.form.get('quantity') or 0)
        price = float(request.form.get('price') or 0)
        expiry_date = request.form.get('expiry_date','').strip()
        description = request.form.get('description','').strip()
        # handle uploaded image
        image_file = request.files.get('image')
        image_filename = save_uploaded_file(image_file)
        conn = get_conn()
        cur = conn.cursor()
        cur.execute("INSERT INTO products (name, category, quantity, price, expiry_date, description, image) VALUES (?,?,?,?,?,?,?)",
                    (name, category, quantity, price, expiry_date, description, image_filename))
        conn.commit()
        conn.close()
        return redirect(url_for('products'))
    return render_template('add_product.html')


@app.route('/edit/<int:pid>', methods=['GET','POST'])
def edit_product(pid):
    conn = get_conn()
    cur = conn.cursor()
    if request.method == 'POST':
        name = request.form.get('name','').strip()
        category = request.form.get('category','').strip()
        quantity = int(request.form.get('quantity') or 0)
        price = float(request.form.get('price') or 0)
        expiry_date = request.form.get('expiry_date','').strip()
        description = request.form.get('description','').strip()
        remove_image = request.form.get('remove_image')
        image_file = request.files.get('image')

        # fetch current image
        cur.execute('SELECT image FROM products WHERE id=?', (pid,))
        r = cur.fetchone()
        current_image = r[0] if r else None

        new_image = current_image
        if remove_image and current_image:
            # delete file if exists
            try:
                os.remove(os.path.join(UPLOADS_DIR, current_image))
            except Exception:
                pass
            new_image = None
        if image_file:
            saved = save_uploaded_file(image_file)
            if saved:
                # remove old
                if current_image:
                    try:
                        os.remove(os.path.join(UPLOADS_DIR, current_image))
                    except Exception:
                        pass
                new_image = saved

        cur.execute("UPDATE products SET name=?, category=?, quantity=?, price=?, expiry_date=?, description=?, image=? WHERE id=?",
                    (name, category, quantity, price, expiry_date, description, new_image, pid))
        conn.commit()
        conn.close()
        return redirect(url_for('products'))

    cur.execute('SELECT * FROM products WHERE id=?', (pid,))
    row = cur.fetchone()
    if not row:
        conn.close()
        return 'Not found', 404
    cols = [c[0] for c in cur.description]
    product = dict(zip(cols, row))
    conn.close()
    return render_template('add_product.html', product=product)

@app.route('/products')
def products():
    q = request.args.get('q','').strip()
    conn = get_conn()
    cur = conn.cursor()
    if q:
        cur.execute("SELECT * FROM products WHERE name LIKE ? OR category LIKE ? ORDER BY id DESC", ('%'+q+'%','%'+q+'%'))
    else:
        cur.execute("SELECT * FROM products ORDER BY id DESC")
    rows = cur.fetchall()
    cols = [c[0] for c in cur.description]
    conn.close()
    return render_template('products.html', items=rows_to_dicts(rows, cols), search=q)

# API: add/edit/delete/update sale
@app.route('/api/products', methods=['GET','POST'])
def api_products():
    if request.method == 'POST':
        data = request.json
        conn = get_conn()
        cur = conn.cursor()
        cur.execute("INSERT INTO products (name, category, quantity, price, expiry_date, description, image) VALUES (?,?,?,?,?,?,?)",
                    (data.get('name'), data.get('category'), int(data.get('quantity') or 0), float(data.get('price') or 0),
                     data.get('expiry_date'), data.get('description'), data.get('image')))
        conn.commit()
        conn.close()
        return jsonify({'status':'ok'})
    else:
        conn = get_conn()
        cur = conn.cursor()
        cur.execute("SELECT * FROM products")
        rows = cur.fetchall()
        cols = [c[0] for c in cur.description]
        conn.close()
        return jsonify(rows_to_dicts(rows, cols))

@app.route('/api/products/<int:pid>', methods=['PUT','DELETE'])
def api_modify(pid):
    conn = get_conn()
    cur = conn.cursor()
    if request.method == 'PUT':
        data = request.json
        cur.execute("UPDATE products SET name=?, category=?, quantity=?, price=?, expiry_date=?, description=? WHERE id=?",
                    (data.get('name'), data.get('category'), int(data.get('quantity') or 0), float(data.get('price') or 0),
                     data.get('expiry_date'), data.get('description'), pid))
        conn.commit()
        conn.close()
        return jsonify({'status':'ok'})
    else:
        cur.execute("DELETE FROM products WHERE id=?", (pid,))
        conn.commit()
        conn.close()
        return jsonify({'status':'ok'})

@app.route('/api/sale', methods=['POST'])
def api_sale():
    data = request.json
    pid = int(data.get('id'))
    amount = int(data.get('amount') or 1)
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("SELECT quantity, sold FROM products WHERE id=?", (pid,))
    r = cur.fetchone()
    if not r:
        conn.close()
        return jsonify({'error':'not found'}),404
    qty, sold = r
    new_qty = max(0, qty - amount)
    new_sold = sold + amount
    cur.execute("UPDATE products SET quantity=?, sold=? WHERE id=?", (new_qty, new_sold, pid))
    conn.commit()
    conn.close()
    return jsonify({'status':'ok', 'new_quantity': new_qty, 'sold': new_sold})

# ---------- AI analysis (محلي) ----------
def parse_date_safe(s):
    try:
        return datetime.datetime.strptime(s, '%Y-%m-%d').date()
    except Exception:
        return None

def analyze_inventory():
    conn = get_conn()
    df = pd.read_sql_query("SELECT * FROM products", conn)
    conn.close()
    today = datetime.date.today()

    # ensure columns exist
    if df.empty:
        return {'most_consumed':[], 'expired':[], 'low_stock':[], 'to_reorder':[], 'summaries':[]}

    df['sold'] = df['sold'].fillna(0).astype(int)
    df['quantity'] = df['quantity'].fillna(0).astype(int)
    df['expiry_date'] = df['expiry_date'].fillna('')

    most_consumed = df.sort_values('sold', ascending=False).head(10).to_dict(orient='records')

    # build a proper boolean mask (no None/NA) for expired dates
    expired_mask = df['expiry_date'].apply(lambda s: parse_date_safe(s)).apply(lambda d: bool(d and d < today))
    expired = df[expired_mask].to_dict(orient='records')

    low_stock = df[df['quantity'] <= 5].to_dict(orient='records')

    to_reorder = df[(df['quantity'] <= 5) | ((df['sold'] >= 10) & (df['quantity'] <= 10))].to_dict(orient='records')

    summaries = []
    for _, row in df.iterrows():
        ed = parse_date_safe(row.get('expiry_date') or '')
        ed_str = ed.isoformat() if ed else 'غير محدد'
        txt = f"المنتج '{row['name']}' من الفئة {row.get('category') or 'عام'}. الكمية: {int(row['quantity'])}. مبيعات مسجلة: {int(row['sold'])}. تاريخ الصلاحية: {ed_str}."
        if ed and ed < today:
            txt += " هذا المنتج منتهي الصلاحية."
        elif row['quantity'] <= 2:
            txt += " الكمية منخفضة جدا. يوصى بإعادة الطلب فورًا."
        elif row['sold'] >= 20:
            txt += " منتج سريع الدوران. زيادة المخزون موصى بها."
        summaries.append({'id': int(row['id']), 'summary': txt})

    return {
        'most_consumed': most_consumed,
        'expired': expired,
        'low_stock': low_stock,
        'to_reorder': to_reorder,
        'summaries': summaries
    }

@app.route('/ai')
def ai_page():
    return render_template('ai.html')

@app.route('/api/ai_report', methods=['GET'])
def api_ai_report():
    return jsonify(analyze_inventory())

@app.route('/sales', methods=['GET','POST'])
def sales():
    if request.method == 'POST':
        # Expect JSON data: list of {id, amount}
        data = request.json
        if not data or not isinstance(data, list):
            return jsonify({'error': 'Invalid data'}), 400
        conn = get_conn()
        cur = conn.cursor()
        results = []
        for item in data:
            pid = int(item.get('id'))
            amount = int(item.get('amount') or 1)
            cur.execute("SELECT quantity, sold FROM products WHERE id=?", (pid,))
            r = cur.fetchone()
            if not r:
                results.append({'id': pid, 'error': 'not found'})
                continue
            qty, sold = r
            new_qty = max(0, qty - amount)
            new_sold = sold + amount
            cur.execute("UPDATE products SET quantity=?, sold=? WHERE id=?", (new_qty, new_sold, pid))
            results.append({'id': pid, 'new_quantity': new_qty, 'sold': new_sold})
        conn.commit()
        conn.close()
        return jsonify({'status': 'ok', 'results': results})
    else:
        # GET: render form with products
        conn = get_conn()
        cur = conn.cursor()
        cur.execute("SELECT id, name, quantity FROM products WHERE quantity > 0 ORDER BY name")
        rows = cur.fetchall()
        cols = [c[0] for c in cur.description]
        products = rows_to_dicts(rows, cols)
        conn.close()
        return render_template('sales.html', products=products)

@app.route('/expired')
def expired():
    conn = get_conn()
    cur = conn.cursor()
    today = datetime.date.today().isoformat()
    cur.execute("SELECT * FROM products WHERE expiry_date IS NOT NULL AND expiry_date <> '' AND expiry_date < ? ORDER BY expiry_date ASC", (today,))
    rows = cur.fetchall()
    cols = [c[0] for c in cur.description]
    conn.close()
    return render_template('expired.html', items=rows_to_dicts(rows, cols))

@app.route('/api/export_excel', methods=['GET'])
def export_excel():
    report = analyze_inventory()
    # Prepare DataFrame with key sections
    rows = []
    for r in report['summaries']:
        rows.append({'تحليل': r['summary']})
    df = pd.DataFrame(rows)
    # try Excel (openpyxl); if not available, fallback to CSV
    try:
        buf = io.BytesIO()
        with pd.ExcelWriter(buf, engine='openpyxl') as writer:
            df.to_excel(writer, index=False, sheet_name='تقرير')
        buf.seek(0)
        filename = f"ai_report_{datetime.datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"
        return send_file(buf, as_attachment=True, download_name=filename, mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    except ModuleNotFoundError:
        # fallback: CSV
        csv_buf = io.StringIO()
        df.to_csv(csv_buf, index=False)
        csv_buf.seek(0)
        filename = f"ai_report_{datetime.datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
        return send_file(io.BytesIO(csv_buf.getvalue().encode('utf-8')), as_attachment=True, download_name=filename, mimetype='text/csv')

@app.route('/api/predictions', methods=['GET'])
def get_predictions():
    """الحصول على التنبؤات والإشعارات الذكية"""
    try:
        conn = get_conn()
        df = pd.read_sql_query("SELECT * FROM products", conn)
        conn.close()
        
        if df.empty:
            return jsonify({'predictions': [], 'notifications': []})
        
        today = datetime.date.today()
        predictions = []
        notifications = []
        
        # تحليل البيانات
        df['sold'] = df['sold'].fillna(0).astype(int)
        df['quantity'] = df['quantity'].fillna(0).astype(int)
        df['expiry_date'] = df['expiry_date'].fillna('')
        df['expiry_date_parsed'] = df['expiry_date'].apply(lambda x: parse_date_safe(x) if x else None)
        
        # التنبؤات والإشعارات
        for _, row in df.iterrows():
            product_id = int(row['id'])
            name = row['name']
            quantity = int(row['quantity'])
            sold = int(row['sold'])
            price = float(row['price'])
            expiry_date = row['expiry_date_parsed']
            
            # إشعارات فورية
            if expiry_date and expiry_date < today:
                notifications.append({
                    'type': 'urgent',
                    'title': 'منتج منتهي الصلاحية',
                    'message': f'المنتج "{name}" منتهي الصلاحية منذ {abs((today - expiry_date).days)} يوم',
                    'product_id': product_id,
                    'severity': 'high',
                    'action': 'remove_or_review'
                })
            elif expiry_date and (expiry_date - today).days <= 7:
                notifications.append({
                    'type': 'warning',
                    'title': 'منتج سينتهي قريباً',
                    'message': f'المنتج "{name}" سينتهي خلال {(expiry_date - today).days} أيام',
                    'product_id': product_id,
                    'severity': 'medium',
                    'action': 'review_soon'
                })
            
            if quantity <= 2:
                notifications.append({
                    'type': 'urgent',
                    'title': 'كمية منخفضة جداً',
                    'message': f'المنتج "{name}" لديه {quantity} وحدة فقط',
                    'product_id': product_id,
                    'severity': 'high',
                    'action': 'reorder_immediately'
                })
            elif quantity <= 5:
                notifications.append({
                    'type': 'warning',
                    'title': 'كمية منخفضة',
                    'message': f'المنتج "{name}" لديه {quantity} وحدات فقط',
                    'product_id': product_id,
                    'severity': 'medium',
                    'action': 'consider_reorder'
                })
            
            # التنبؤات الذكية
            if sold > 0 and quantity > 0:
                # حساب معدل الاستهلاك اليومي
                days_since_start = 30  # افتراض أن النظام يعمل منذ 30 يوم
                daily_consumption = sold / days_since_start
                
                if daily_consumption > 0:
                    days_until_empty = quantity / daily_consumption
                    
                    if days_until_empty <= 7:
                        predictions.append({
                            'type': 'stock_prediction',
                            'title': 'تنبؤ نفاد المخزون',
                            'message': f'المنتج "{name}" قد ينفد خلال {int(days_until_empty)} أيام',
                            'product_id': product_id,
                            'confidence': 'high',
                            'predicted_date': (today + datetime.timedelta(days=int(days_until_empty))).isoformat(),
                            'recommendation': 'reorder_now'
                        })
                    elif days_until_empty <= 14:
                        predictions.append({
                            'type': 'stock_prediction',
                            'title': 'تنبؤ نفاد المخزون',
                            'message': f'المنتج "{name}" قد ينفد خلال {int(days_until_empty)} أيام',
                            'product_id': product_id,
                            'confidence': 'medium',
                            'predicted_date': (today + datetime.timedelta(days=int(days_until_empty))).isoformat(),
                            'recommendation': 'plan_reorder'
                        })
            
            # تنبؤات المبيعات
            if sold >= 20:
                predictions.append({
                    'type': 'sales_prediction',
                    'title': 'منتج شائع',
                    'message': f'المنتج "{name}" يحقق مبيعات عالية ({sold} مبيع)',
                    'product_id': product_id,
                    'confidence': 'high',
                    'recommendation': 'increase_stock'
                })
            
            # تنبؤات القيمة
            total_value = quantity * price
            if total_value > 1000:
                predictions.append({
                    'type': 'value_prediction',
                    'title': 'منتج عالي القيمة',
                    'message': f'المنتج "{name}" بقيمة {total_value:.2f} ر.م',
                    'product_id': product_id,
                    'confidence': 'high',
                    'recommendation': 'monitor_closely'
                })
        
        # ترتيب الإشعارات حسب الأولوية
        notifications.sort(key=lambda x: {'high': 3, 'medium': 2, 'low': 1}[x['severity']], reverse=True)
        
        # ترتيب التنبؤات حسب الثقة
        predictions.sort(key=lambda x: {'high': 3, 'medium': 2, 'low': 1}[x['confidence']], reverse=True)
        
        return jsonify({
            'predictions': predictions[:10],  # أفضل 10 تنبؤات
            'notifications': notifications[:15],  # أفضل 15 إشعار
            'summary': {
                'total_products': len(df),
                'urgent_notifications': len([n for n in notifications if n['severity'] == 'high']),
                'warnings': len([n for n in notifications if n['severity'] == 'medium']),
                'predictions_count': len(predictions)
            }
        })
        
    except Exception as e:
        return jsonify({'error': f'خطأ في الحصول على التنبؤات: {str(e)}'}), 500

@app.route('/api/export_custom_excel', methods=['POST'])
def export_custom_excel():
    try:
        data = request.json
        report_type = data.get('type', 'general')
        
        conn = get_conn()
        df = pd.read_sql_query("SELECT * FROM products", conn)
        conn.close()
        
        if df.empty:
            return jsonify({'error': 'لا توجد بيانات للتصدير'}), 400
        
        buf = io.BytesIO()
        
        with pd.ExcelWriter(buf, engine='openpyxl') as writer:
            if report_type == 'expired':
                # تقرير المنتجات المنتهية الصلاحية
                today = datetime.date.today()
                df['expiry_date_parsed'] = df['expiry_date'].apply(lambda x: parse_date_safe(x) if x else None)
                expired_df = df[df['expiry_date_parsed'].apply(lambda x: x and x < today)]
                
                if not expired_df.empty:
                    expired_export = expired_df[['name', 'category', 'quantity', 'price', 'expiry_date', 'description']].copy()
                    expired_export.columns = ['اسم المنتج', 'الفئة', 'الكمية', 'السعر', 'تاريخ الانتهاء', 'الوصف']
                    expired_export.to_excel(writer, index=False, sheet_name='منتجات منتهية')
                else:
                    # إنشاء ورقة فارغة مع رسالة
                    empty_df = pd.DataFrame({'رسالة': ['لا توجد منتجات منتهية الصلاحية']})
                    empty_df.to_excel(writer, index=False, sheet_name='منتجات منتهية')
                    
            elif report_type == 'low_stock':
                # تقرير المنتجات ذات الكمية المنخفضة
                low_stock_df = df[df['quantity'] <= 5]
                
                if not low_stock_df.empty:
                    low_stock_export = low_stock_df[['name', 'category', 'quantity', 'price', 'sold', 'description']].copy()
                    low_stock_export.columns = ['اسم المنتج', 'الفئة', 'الكمية الحالية', 'السعر', 'المبيعات', 'الوصف']
                    low_stock_export.to_excel(writer, index=False, sheet_name='كمية منخفضة')
                else:
                    empty_df = pd.DataFrame({'رسالة': ['جميع المنتجات لديها كمية كافية']})
                    empty_df.to_excel(writer, index=False, sheet_name='كمية منخفضة')
                    
            elif report_type == 'most_sold':
                # تقرير أكثر المنتجات مبيعاً
                most_sold_df = df.sort_values('sold', ascending=False).head(10)
                
                if not most_sold_df.empty:
                    most_sold_export = most_sold_df[['name', 'category', 'sold', 'quantity', 'price']].copy()
                    most_sold_export.columns = ['اسم المنتج', 'الفئة', 'المبيعات', 'الكمية المتبقية', 'السعر']
                    most_sold_export.to_excel(writer, index=False, sheet_name='أكثر مبيعاً')
                else:
                    empty_df = pd.DataFrame({'رسالة': ['لا توجد بيانات مبيعات']})
                    empty_df.to_excel(writer, index=False, sheet_name='أكثر مبيعاً')
                    
            elif report_type == 'complete':
                # تقرير شامل
                # ورقة المنتجات الكاملة
                complete_df = df[['name', 'category', 'quantity', 'price', 'expiry_date', 'sold', 'description']].copy()
                complete_df.columns = ['اسم المنتج', 'الفئة', 'الكمية', 'السعر', 'تاريخ الانتهاء', 'المبيعات', 'الوصف']
                complete_df.to_excel(writer, index=False, sheet_name='جميع المنتجات')
                
                # ورقة الإحصائيات
                stats_data = {
                    'الإحصائية': [
                        'إجمالي المنتجات',
                        'المنتجات المنتهية الصلاحية',
                        'المنتجات ذات الكمية المنخفضة',
                        'إجمالي المبيعات',
                        'إجمالي القيمة'
                    ],
                    'القيمة': [
                        len(df),
                        len(df[df['expiry_date'].apply(lambda x: parse_date_safe(x) and parse_date_safe(x) < datetime.date.today() if x else False)]),
                        len(df[df['quantity'] <= 5]),
                        df['sold'].sum(),
                        (df['quantity'] * df['price']).sum()
                    ]
                }
                stats_df = pd.DataFrame(stats_data)
                stats_df.to_excel(writer, index=False, sheet_name='إحصائيات')
                
            else:
                # تقرير عام
                general_df = df[['name', 'category', 'quantity', 'price', 'expiry_date']].copy()
                general_df.columns = ['اسم المنتج', 'الفئة', 'الكمية', 'السعر', 'تاريخ الانتهاء']
                general_df.to_excel(writer, index=False, sheet_name='تقرير عام')
        
        buf.seek(0)
        filename = f"custom_report_{report_type}_{datetime.datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"
        
        return send_file(
            buf, 
            as_attachment=True, 
            download_name=filename, 
            mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        )
        
    except Exception as e:
        return jsonify({'error': f'خطأ في إنشاء التقرير: {str(e)}'}), 500

if __name__ == '__main__':
    # bind to 0.0.0.0 so the dev server can be accessed from other devices on the local network
    app.run(host='0.0.0.0', debug=True)
# To run the app, execute: python backend.py
