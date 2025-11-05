// صفحات: تهيئة عامة + وظائف الشات والأزرار + وظائف المنتجات
async function fetchProductsJSON(){
  const r = await fetch('/api/products');
  return await r.json();
}

// ---------- صفحة AI: الأزرار الجاهزة تظل لكن الشات المركزي هو المصدر الوحيد ----------
if(location.pathname.startsWith('/ai')){
  // زر لفتح الشات العام من داخل صفحة الذكاء
  const openBtn = document.getElementById('openGlobalChat');
  if(openBtn){
    openBtn.addEventListener('click', (e)=>{ e.preventDefault(); const chatToggle = document.getElementById('chatToggle'); if(chatToggle) chatToggle.click(); });
  }
  // تقرير الأزرار الجاهزة: تقارير حقيقية
  const buttons = document.querySelectorAll('.report-btn');
  buttons.forEach(b => b.addEventListener('click', async ()=>{
    const q = b.dataset.q;
    b.disabled = true;
    b.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جارٍ التحليل...';
    
    try {
      const response = await fetch('/api/ai_report');
      const report = await response.json();
      
      let reportMessage = '';
      
      if(q === 'الأكثر استهلاكا'){
        if(report.most_consumed && report.most_consumed.length > 0){
          reportMessage = '🔥 المنتجات الأكثر استهلاكًا:\n\n';
          report.most_consumed.slice(0, 5).forEach((p, index) => {
            reportMessage += `${index + 1}. ${p.name} - ${p.sold || 0} مبيع\n`;
          });
        } else {
          reportMessage = '📊 لا توجد بيانات مبيعات كافية.';
        }
      } else if(q === 'منتهي الصلاحية'){
        if(report.expired && report.expired.length > 0){
          reportMessage = '🚨 المنتجات المنتهية الصلاحية:\n\n';
          report.expired.forEach((p, index) => {
            reportMessage += `${index + 1}. ${p.name} - انتهى في ${p.expiry_date}\n`;
          });
        } else {
          reportMessage = '✅ لا توجد منتجات منتهية الصلاحية.';
        }
      } else if(q === 'الكمية القليلة'){
        if(report.low_stock && report.low_stock.length > 0){
          reportMessage = '⚠️ المنتجات ذات الكمية المنخفضة:\n\n';
          report.low_stock.forEach((p, index) => {
            reportMessage += `${index + 1}. ${p.name} - الكمية: ${p.quantity}\n`;
          });
    } else {
          reportMessage = '✅ جميع المنتجات لديها كمية كافية.';
        }
      } else if(q === 'ملخص عام'){
        const totalProducts = report.summaries ? report.summaries.length : 0;
        const expiredCount = report.expired ? report.expired.length : 0;
        const lowCount = report.low_stock ? report.low_stock.length : 0;
        
        reportMessage = `📊 ملخص المخزون:\n\n`;
        reportMessage += `📦 إجمالي المنتجات: ${totalProducts}\n`;
        reportMessage += `🚨 منتهي الصلاحية: ${expiredCount}\n`;
        reportMessage += `⚠️ كمية منخفضة: ${lowCount}\n`;
        
        if(report.most_consumed && report.most_consumed.length > 0){
          const topProduct = report.most_consumed[0];
          reportMessage += `🏆 الأكثر مبيعاً: ${topProduct.name} (${topProduct.sold} مبيع)`;
        }
      }
      
      // عرض التقرير في نافذة منبثقة
      const modal = document.createElement('div');
      modal.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%; 
        background: rgba(0,0,0,0.5); z-index: 2000; display: flex; 
        align-items: center; justify-content: center;
      `;
      
      const content = document.createElement('div');
      content.style.cssText = `
        background: white; padding: 30px; border-radius: 12px; 
        max-width: 500px; max-height: 80%; overflow-y: auto;
        box-shadow: 0 20px 40px rgba(0,0,0,0.3);
      `;
      
      content.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
          <h3 style="margin: 0; color: #1e293b;">📋 تقرير ${q}</h3>
          <button id="closeModal" style="background: none; border: none; font-size: 24px; cursor: pointer;">×</button>
        </div>
        <div style="white-space: pre-line; line-height: 1.6; color: #374151;">${reportMessage}</div>
        <div style="margin-top: 20px; text-align: center;">
          <button id="exportBtn" style="background: #3b82f6; color: white; border: none; padding: 10px 20px; border-radius: 8px; cursor: pointer; margin-right: 10px;">
            <i class="fas fa-download"></i> تصدير Excel
          </button>
          <button id="chatBtn" style="background: #10b981; color: white; border: none; padding: 10px 20px; border-radius: 8px; cursor: pointer;">
            <i class="fas fa-comments"></i> فتح الشات
          </button>
        </div>
      `;
      
      modal.appendChild(content);
      document.body.appendChild(modal);
      
      // إضافة المستمعين للأحداث
      document.getElementById('closeModal').onclick = () => modal.remove();
      document.getElementById('exportBtn').onclick = () => {
        window.open('/api/export_excel', '_blank');
        modal.remove();
      };
      document.getElementById('chatBtn').onclick = () => {
        const chatToggle = document.getElementById('chatToggle');
        if(chatToggle) chatToggle.click();
        modal.remove();
      };
      
      // إغلاق عند النقر خارج المحتوى
      modal.onclick = (e) => {
        if(e.target === modal) modal.remove();
      };
      
    } catch (error) {
      alert('❌ حدث خطأ في جلب التقرير. يرجى المحاولة مرة أخرى.');
    } finally {
      b.disabled = false;
      b.innerHTML = b.dataset.q;
    }
  }));
}

// ---------- صفحة products: تسجيل بيع وحذف ----------
if(location.pathname.startsWith('/products')){
  document.addEventListener('click', async (e) => {
    if(e.target && e.target.matches('.sell')){
      const id = e.target.dataset.id;
      const amount = Number(prompt('كمية البيع', '1')) || 1;
      await fetch('/api/sale', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({id, amount})});
      location.reload();
    }
    if(e.target && e.target.matches('.del')){
      const id = e.target.dataset.id;
      if(confirm('هل تريد حذف المنتج؟')){
        await fetch('/api/products/' + id, {method:'DELETE'});
        location.reload();
      }
    }
  });
}

// ---------- index page small init ----------
if(location.pathname === '/'){
  // nothing else required for now
}

// ---------- sales page ----------
if(location.pathname.startsWith('/sales')){
  document.getElementById('submit-sales').addEventListener('click', async () => {
    const items = [];
    document.querySelectorAll('.sale-item').forEach(div => {
      const id = parseInt(div.dataset.id);
      const amount = parseInt(div.querySelector('.amount-input').value) || 0;
      if(amount > 0){
        items.push({id, amount});
      }
    });
    if(items.length === 0){
      document.getElementById('message').innerHTML = '<p style="color:red;">لم يتم اختيار أي مبيعات.</p>';
      return;
    }
    const response = await fetch('/sales', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(items)
    });
    const result = await response.json();
    if(result.status === 'ok'){
      document.getElementById('message').innerHTML = '<p style="color:green;">تم تسجيل المبيعات بنجاح.</p>';
      // reset inputs
      document.querySelectorAll('.amount-input').forEach(inp => inp.value = '0');
      // optionally reload to update quantities, but for now just message
    } else {
      document.getElementById('message').innerHTML = '<p style="color:red;">خطأ في التسجيل.</p>';
    }
  });
}

// optional notification banner handling
function showNotifyIfRequested(){
  const params = new URLSearchParams(location.search);
  if(params.get('notify') !== '1') return;
  if(localStorage.getItem('notify_skip')) return;
  const banner = document.createElement('div');
  banner.className = 'notify-banner';
  banner.innerHTML = `<div class="msg">تنبيه اختياري: يمكنك تخطي هذا الإشعار بالضغط على تخطي.</div><div><button class="btn" id="notify-skip">تخطي</button> <button class="close" id="notify-close">إغلاق</button></div>`;
  const container = document.querySelector('.container') || document.body;
  container.prepend(banner);
  document.getElementById('notify-close').addEventListener('click', ()=> banner.remove());
  document.getElementById('notify-skip').addEventListener('click', ()=>{ localStorage.setItem('notify_skip','1'); banner.remove(); });
}

showNotifyIfRequested();

// Image preview for add/edit product
if(location.pathname.includes('/add') || location.pathname.includes('/edit')){
  const imageInput = document.getElementById('image-upload');
  const preview = document.getElementById('image-preview');
  if(imageInput && preview){
    imageInput.addEventListener('change', function(e){
      const file = e.target.files[0];
      if(file){
        const reader = new FileReader();
        reader.onload = function(e){
          preview.innerHTML = '<img src="' + e.target.result + '" alt="Preview">';
        };
        reader.readAsDataURL(file);
      } else {
        preview.innerHTML = '';
      }
    });
  }
}

// ---------- Notifications System ----------
(() => {
  const notificationsToggle = document.getElementById('notificationsToggle');
  const notificationsPanel = document.getElementById('notificationsPanel');
  const notificationsContent = document.getElementById('notificationsContent');
  const notificationsClose = document.getElementById('notificationsClose');
  const notificationCount = document.getElementById('notificationCount');

  if (!notificationsToggle || !notificationsPanel) return;

  function openNotifications() {
    notificationsPanel.classList.remove('hidden');
    notificationsPanel.setAttribute('aria-hidden', 'false');
    loadNotifications();
  }

  function closeNotifications() {
    notificationsPanel.classList.add('hidden');
    notificationsPanel.setAttribute('aria-hidden', 'true');
  }

  notificationsToggle.addEventListener('click', () => {
    if (notificationsPanel.classList.contains('hidden')) {
      openNotifications();
    } else {
      closeNotifications();
    }
  });

  notificationsClose.addEventListener('click', closeNotifications);

  async function loadNotifications() {
    try {
      const response = await fetch('/api/predictions');
      const data = await response.json();

      if (data.error) {
        notificationsContent.innerHTML = `
          <div class="notification-item">
            <div class="notification-title">❌ خطأ</div>
            <div class="notification-message">${data.error}</div>
          </div>
        `;
        return;
      }

      let html = '';

      // إحصائيات ملخص
      if (data.summary) {
        html += `
          <div class="summary-stats">
            <div class="stat-item">
              <div class="stat-number">${data.summary.total_products}</div>
              <div class="stat-label">إجمالي المنتجات</div>
            </div>
            <div class="stat-item">
              <div class="stat-number">${data.summary.urgent_notifications}</div>
              <div class="stat-label">إشعارات عاجلة</div>
            </div>
            <div class="stat-item">
              <div class="stat-number">${data.summary.warnings}</div>
              <div class="stat-label">تحذيرات</div>
            </div>
            <div class="stat-item">
              <div class="stat-number">${data.summary.predictions_count}</div>
              <div class="stat-label">تنبؤات</div>
            </div>
          </div>
        `;
      }

      // الإشعارات
      if (data.notifications && data.notifications.length > 0) {
        html += '<h4 style="margin: 16px 0 8px 0; color: var(--text-primary);">🚨 الإشعارات العاجلة</h4>';
        
        data.notifications.forEach(notification => {
          const icon = notification.severity === 'high' ? '🔴' : '🟡';
          html += `
            <div class="notification-item ${notification.severity}">
              <div class="notification-title">
                ${icon} ${notification.title}
              </div>
              <div class="notification-message">${notification.message}</div>
              <div class="notification-actions">
                <button class="notification-action primary" onclick="handleNotificationAction('${notification.action}', ${notification.product_id})">
                  ${getActionText(notification.action)}
                </button>
              </div>
            </div>
          `;
        });
      }

      // التنبؤات
      if (data.predictions && data.predictions.length > 0) {
        html += '<h4 style="margin: 16px 0 8px 0; color: var(--text-primary);">🔮 التنبؤات الذكية</h4>';
        
        data.predictions.slice(0, 5).forEach(prediction => {
          const icon = prediction.confidence === 'high' ? '🎯' : '📊';
          html += `
            <div class="notification-item prediction-item">
              <div class="notification-title">
                ${icon} ${prediction.title}
              </div>
              <div class="notification-message">${prediction.message}</div>
              <div class="notification-actions">
                <button class="notification-action secondary" onclick="handlePredictionAction('${prediction.recommendation}', ${prediction.product_id})">
                  ${getRecommendationText(prediction.recommendation)}
                </button>
              </div>
            </div>
          `;
        });
      }

      if (!data.notifications || data.notifications.length === 0) {
        html += `
          <div class="notification-item low">
            <div class="notification-title">✅ لا توجد إشعارات عاجلة</div>
            <div class="notification-message">جميع المنتجات في حالة جيدة!</div>
          </div>
        `;
      }

      notificationsContent.innerHTML = html;

      // تحديث عداد الإشعارات
      const urgentCount = data.summary ? data.summary.urgent_notifications : 0;
      if (urgentCount > 0) {
        notificationCount.textContent = urgentCount;
        notificationCount.classList.remove('hidden');
      } else {
        notificationCount.classList.add('hidden');
      }

    } catch (error) {
      notificationsContent.innerHTML = `
        <div class="notification-item">
          <div class="notification-title">❌ خطأ في التحميل</div>
          <div class="notification-message">حدث خطأ في جلب الإشعارات. يرجى المحاولة مرة أخرى.</div>
        </div>
      `;
    }
  }

  function getActionText(action) {
    const actions = {
      'remove_or_review': 'مراجعة',
      'review_soon': 'مراجعة قريباً',
      'reorder_immediately': 'طلب فوري',
      'consider_reorder': 'النظر في الطلب'
    };
    return actions[action] || 'إجراء';
  }

  function getRecommendationText(recommendation) {
    const recommendations = {
      'reorder_now': 'طلب الآن',
      'plan_reorder': 'تخطيط الطلب',
      'increase_stock': 'زيادة المخزون',
      'monitor_closely': 'مراقبة دقيقة'
    };
    return recommendations[recommendation] || 'توصية';
  }

  // تحديث الإشعارات كل 5 دقائق
  setInterval(() => {
    if (!notificationsPanel.classList.contains('hidden')) {
      loadNotifications();
    }
  }, 300000);

  // تحديث عداد الإشعارات عند تحميل الصفحة
  loadNotifications();

})();

// ---------- Global chat widget (site-wide) ----------
(() => {
  const chatToggle = document.getElementById('chatToggle');
  const globalChat = document.getElementById('globalChat');
  if(!chatToggle || !globalChat) return;

  const globalChatWindow = document.getElementById('globalChatWindow');
  const globalChatForm = document.getElementById('globalChatForm');
  const globalChatInput = document.getElementById('globalChatInput');
  const globalChatClose = document.getElementById('globalChatClose');

  function gAppendMessage(text, who, buttons = null){
    const row = document.createElement('div');
    row.className = 'msg-row ' + (who==='user' ? 'right' : 'left');
    const box = document.createElement('div');
    box.className = 'bubble ' + (who==='user' ? 'user' : 'ai');
    box.textContent = text;
    row.appendChild(box);
    
    // إضافة أزرار إذا كانت متوفرة
    if(buttons && who === 'ai'){
      const buttonContainer = document.createElement('div');
      buttonContainer.style.cssText = 'margin-top: 10px; display: flex; flex-wrap: wrap; gap: 5px;';
      
      buttons.forEach(button => {
        const btn = document.createElement('button');
        btn.textContent = button.text;
        btn.style.cssText = `
          background: #3b82f6; color: white; border: none; 
          padding: 5px 10px; border-radius: 6px; cursor: pointer; 
          font-size: 12px; transition: background 0.2s ease;
        `;
        btn.onmouseover = () => btn.style.background = '#1e40af';
        btn.onmouseout = () => btn.style.background = '#3b82f6';
        btn.onclick = button.action;
        buttonContainer.appendChild(btn);
      });
      
      row.appendChild(buttonContainer);
    }
    
    globalChatWindow.appendChild(row);
    globalChatWindow.scrollTop = globalChatWindow.scrollHeight;
  }

  function openChat(){
    globalChat.classList.remove('hidden');
    globalChat.setAttribute('aria-hidden','false');
    globalChatInput && globalChatInput.focus();
    localStorage.setItem('globalChatOpen','1');
  }
  function closeChat(){
    globalChat.classList.add('hidden');
    globalChat.setAttribute('aria-hidden','true');
    localStorage.removeItem('globalChatOpen');
  }

  chatToggle.addEventListener('click', () => {
    if(globalChat.classList.contains('hidden')) openChat(); else closeChat();
  });
  globalChatClose && globalChatClose.addEventListener('click', closeChat);

  // preserve open state across page loads
  if(localStorage.getItem('globalChatOpen')) openChat();
  
  // إضافة رسالة ترحيب مع أزرار سريعة
  function addWelcomeMessage(){
    const welcomeText = '🤖 مرحباً! أنا مساعد المخزن الذكي.\n\nيمكنني مساعدتك في:\n• 📊 تحليل المخزون\n• 🚨 المنتجات المنتهية الصلاحية\n• ⚠️ المنتجات ذات الكمية المنخفضة\n• 🔥 أكثر المنتجات مبيعاً\n• 📋 إنشاء ملفات Excel مخصصة';
    
    const quickButtons = [
      {
        text: '📊 تقرير شامل',
        action: () => createExcelReport('complete', 'تقرير شامل')
      },
      {
        text: '🚨 منتهي الصلاحية',
        action: () => createExcelReport('expired', 'المنتجات المنتهية الصلاحية')
      },
      {
        text: '⚠️ كمية منخفضة',
        action: () => createExcelReport('low_stock', 'المنتجات ذات الكمية المنخفضة')
      },
      {
        text: '🔥 أكثر مبيعاً',
        action: () => createExcelReport('most_sold', 'أكثر المنتجات مبيعاً')
      }
    ];
    
    gAppendMessage(welcomeText, 'ai', quickButtons);
  }
  
  // دالة إنشاء تقرير Excel
  async function createExcelReport(type, name){
    try {
      const response = await fetch('/api/export_custom_excel', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ type: type })
      });
      
      if(response.ok){
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `تقرير_${name}_${new Date().toISOString().slice(0,10)}.xlsx`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        
        gAppendMessage(`✅ تم إنشاء ${name} بنجاح!\n\n📁 تم تحميل الملف تلقائياً إلى جهازك.`, 'ai');
      } else {
        throw new Error('فشل في إنشاء التقرير');
      }
    } catch (error) {
      gAppendMessage(`❌ حدث خطأ في إنشاء ${name}.\n\n🔧 يرجى المحاولة مرة أخرى.`, 'ai');
    }
  }
  
  // إضافة رسالة الترحيب عند فتح الشات لأول مرة
  setTimeout(() => {
    if(globalChatWindow.children.length === 0){
      addWelcomeMessage();
    }
  }, 500);

  async function handleUserMessage(message){
    gAppendMessage(message, 'user');
    const thinking = document.createElement('div');
    thinking.className = 'msg-row left';
    const thinkingBox = document.createElement('div');
    thinkingBox.className = 'bubble ai';
    thinkingBox.textContent = 'جارٍ التفكير...';
    thinking.appendChild(thinkingBox);
    globalChatWindow.appendChild(thinking);
    globalChatWindow.scrollTop = globalChatWindow.scrollHeight;

    try {
      // جلب البيانات الحقيقية من الخادم
      const response = await fetch('/api/ai_report');
      const report = await response.json();
      
      setTimeout(async () => {
      thinking.remove();

      const text = message.toLowerCase();
        let aiResponse = '';

      if(text.includes('منته') || text.includes('صلاح') || text.includes('expired') || text.includes('expiry')){
          if(report.expired && report.expired.length > 0){
            aiResponse = '🚨 المنتجات المنتهية الصلاحية:\n\n';
            report.expired.forEach((p, index) => {
              aiResponse += `${index + 1}. ${p.name}\n`;
              aiResponse += `   - الفئة: ${p.category || 'غير محدد'}\n`;
              aiResponse += `   - الكمية: ${p.quantity}\n`;
              aiResponse += `   - تاريخ الانتهاء: ${p.expiry_date}\n`;
              aiResponse += `   - السعر: ${p.price} ر.م\n\n`;
            });
            aiResponse += '💡 يُنصح بإزالة هذه المنتجات أو مراجعتها فورًا.';
        } else {
            aiResponse = '✅ ممتاز! لا توجد منتجات منتهية الصلاحية حاليًا.';
        }
      } else if(text.includes('نقص') || text.includes('كمية') || text.includes('مخزون') || text.includes('low') || text.includes('stock')){
          if(report.low_stock && report.low_stock.length > 0){
            aiResponse = '⚠️ المنتجات ذات الكمية المنخفضة (≤5):\n\n';
            report.low_stock.forEach((p, index) => {
              aiResponse += `${index + 1}. ${p.name}\n`;
              aiResponse += `   - الكمية الحالية: ${p.quantity}\n`;
              aiResponse += `   - المبيعات: ${p.sold || 0}\n`;
              aiResponse += `   - السعر: ${p.price} ر.م\n\n`;
            });
            aiResponse += '🔄 يُنصح بإعادة الطلب لهذه المنتجات فورًا.';
        } else {
            aiResponse = '✅ جميع المنتجات لديها كمية كافية في المخزون.';
        }
      } else if(text.includes('اكثر') || text.includes('مبيع') || text.includes('شائع') || text.includes('most') || text.includes('sold') || text.includes('consumed')){
          if(report.most_consumed && report.most_consumed.length > 0){
            aiResponse = '🔥 المنتجات الأكثر استهلاكًا:\n\n';
            report.most_consumed.slice(0, 5).forEach((p, index) => {
              aiResponse += `${index + 1}. ${p.name}\n`;
              aiResponse += `   - المبيعات: ${p.sold || 0} وحدة\n`;
              aiResponse += `   - الكمية المتبقية: ${p.quantity}\n`;
              aiResponse += `   - السعر: ${p.price} ر.م\n\n`;
            });
            aiResponse += '📈 هذه المنتجات تحقق أعلى معدلات المبيعات.';
          } else {
            aiResponse = '📊 لا توجد بيانات مبيعات كافية حالياً.';
          }
        } else if(text.includes('إعادة') || text.includes('طلب') || text.includes('reorder') || text.includes('order')){
          if(report.to_reorder && report.to_reorder.length > 0){
            aiResponse = '🛒 المنتجات التي تحتاج إعادة طلب:\n\n';
            report.to_reorder.forEach((p, index) => {
              aiResponse += `${index + 1}. ${p.name}\n`;
              aiResponse += `   - الكمية الحالية: ${p.quantity}\n`;
              aiResponse += `   - المبيعات: ${p.sold || 0}\n`;
              aiResponse += `   - السبب: ${p.quantity <= 5 ? 'كمية منخفضة' : 'مبيعات عالية'}\n\n`;
            });
            aiResponse += '⚡ يُنصح بالطلب الفوري لهذه المنتجات.';
        } else {
            aiResponse = '✅ جميع المنتجات لديها مخزون كافي.';
        }
      } else if(text.includes('excel') || text.includes('تصدير') || text.includes('export') || text.includes('شيت') || text.includes('sheet')){
          aiResponse = '📊 يمكنني إنشاء ملفات Excel مخصصة لك!\n\n';
          aiResponse += '🔧 أنواع التقارير المتاحة:\n';
          aiResponse += '• 📋 تقرير عام - جميع المنتجات\n';
          aiResponse += '• 🚨 المنتجات المنتهية الصلاحية\n';
          aiResponse += '• ⚠️ المنتجات ذات الكمية المنخفضة\n';
          aiResponse += '• 🔥 أكثر المنتجات مبيعاً\n';
          aiResponse += '• 📊 تقرير شامل مع إحصائيات\n\n';
          aiResponse += '💬 اكتب "أنشئ تقرير [النوع]" وسأقوم بإنشائه لك فوراً!\n';
          aiResponse += 'مثال: "أنشئ تقرير المنتجات المنتهية الصلاحية"';
      } else if(text.includes('تقرير') || text.includes('report') || text.includes('تحليل') || text.includes('analysis') || text.includes('ملخص') || text.includes('summary')){
          const totalProducts = report.summaries ? report.summaries.length : 0;
          const expiredCount = report.expired ? report.expired.length : 0;
          const lowCount = report.low_stock ? report.low_stock.length : 0;
          const reorderCount = report.to_reorder ? report.to_reorder.length : 0;
          
          aiResponse = '📊 ملخص شامل للمخزون:\n\n';
          aiResponse += `📦 إجمالي المنتجات: ${totalProducts}\n`;
          aiResponse += `🚨 منتهي الصلاحية: ${expiredCount}\n`;
          aiResponse += `⚠️ كمية منخفضة: ${lowCount}\n`;
          aiResponse += `🛒 يحتاج إعادة طلب: ${reorderCount}\n\n`;
          
          if(report.most_consumed && report.most_consumed.length > 0){
            const topProduct = report.most_consumed[0];
            aiResponse += `🏆 أكثر المنتجات مبيعاً: ${topProduct.name} (${topProduct.sold} مبيع)\n\n`;
          }
          
          aiResponse += '💡 اسأل عن تفاصيل محددة لمزيد من المعلومات.';
        } else if(text.includes('تنبؤ') || text.includes('prediction') || text.includes('إشعار') || text.includes('notification') || text.includes('تحذير') || text.includes('alert')){
          // جلب التنبؤات والإشعارات
          try {
            const predictionsResponse = await fetch('/api/predictions');
            const predictionsData = await predictionsResponse.json();
            
            if(predictionsData.notifications && predictionsData.notifications.length > 0){
              aiResponse = '🚨 الإشعارات والتنبيهات:\n\n';
              
              predictionsData.notifications.slice(0, 5).forEach((notification, index) => {
                const icon = notification.severity === 'high' ? '🔴' : '🟡';
                aiResponse += `${icon} ${notification.title}\n`;
                aiResponse += `   ${notification.message}\n\n`;
              });
              
              if(predictionsData.notifications.length > 5){
                aiResponse += `... و ${predictionsData.notifications.length - 5} إشعارات أخرى\n\n`;
              }
            }
            
            if(predictionsData.predictions && predictionsData.predictions.length > 0){
              aiResponse += '🔮 التنبؤات الذكية:\n\n';
              
              predictionsData.predictions.slice(0, 3).forEach((prediction, index) => {
                const icon = prediction.confidence === 'high' ? '🎯' : '📊';
                aiResponse += `${icon} ${prediction.title}\n`;
                aiResponse += `   ${prediction.message}\n`;
                aiResponse += `   التوصية: ${prediction.recommendation}\n\n`;
              });
            }
            
            if(predictionsData.summary){
              aiResponse += `📈 ملخص الإشعارات:\n`;
              aiResponse += `• إجمالي المنتجات: ${predictionsData.summary.total_products}\n`;
              aiResponse += `• إشعارات عاجلة: ${predictionsData.summary.urgent_notifications}\n`;
              aiResponse += `• تحذيرات: ${predictionsData.summary.warnings}\n`;
              aiResponse += `• تنبؤات: ${predictionsData.summary.predictions_count}`;
            }
            
            if(!predictionsData.notifications || predictionsData.notifications.length === 0){
              aiResponse = '✅ ممتاز! لا توجد إشعارات عاجلة حالياً.\n\n';
              aiResponse += '🔮 التنبؤات الذكية:\n';
              aiResponse += '• جميع المنتجات في حالة جيدة\n';
              aiResponse += '• لا توجد مخاطر متوقعة\n';
              aiResponse += '• المخزون متوازن';
            }
            
          } catch (error) {
            aiResponse = '❌ حدث خطأ في جلب التنبؤات والإشعارات.\n\n🔧 يرجى المحاولة مرة أخرى.';
          }
        } else if(text.includes('منتج') && (text.includes('بحث') || text.includes('find') || text.includes('search'))){
          aiResponse = '🔍 للبحث عن منتج محدد:\n\n';
          aiResponse += '1. اذهب إلى صفحة المخزن\n';
          aiResponse += '2. استخدم مربع البحث\n';
          aiResponse += '3. اكتب اسم المنتج أو الفئة\n\n';
          aiResponse += '💡 يمكنك أيضاً إضافة منتج جديد من صفحة "إضافة منتج".';
        } else if(text.includes('مبيعات') || text.includes('sales') || text.includes('بيع')){
          aiResponse = '💰 إدارة المبيعات:\n\n';
          aiResponse += '1. اذهب إلى صفحة "سجل المبيعات"\n';
          aiResponse += '2. اختر المنتجات المباعة\n';
          aiResponse += '3. أدخل الكميات\n';
          aiResponse += '4. اضغط "سجل المبيعات"\n\n';
          aiResponse += '📈 سيتم خصم الكميات من المخزون تلقائياً.';
        } else if(text.includes('أنشئ') || text.includes('إنشاء') || text.includes('create') || text.includes('make')){
          // إنشاء تقارير Excel مخصصة
          let reportType = 'general';
          let reportName = 'تقرير عام';
          
          if(text.includes('منته') || text.includes('صلاح') || text.includes('expired')){
            reportType = 'expired';
            reportName = 'المنتجات المنتهية الصلاحية';
          } else if(text.includes('نقص') || text.includes('كمية') || text.includes('منخفض') || text.includes('low')){
            reportType = 'low_stock';
            reportName = 'المنتجات ذات الكمية المنخفضة';
          } else if(text.includes('اكثر') || text.includes('مبيع') || text.includes('most') || text.includes('sold')){
            reportType = 'most_sold';
            reportName = 'أكثر المنتجات مبيعاً';
          } else if(text.includes('شامل') || text.includes('كامل') || text.includes('complete') || text.includes('all')){
            reportType = 'complete';
            reportName = 'تقرير شامل';
          }
          
          aiResponse = `📊 جاري إنشاء ${reportName}...\n\n`;
          aiResponse += '⏳ يرجى الانتظار قليلاً بينما أقوم بإنشاء الملف...';
          
          // إنشاء الملف
          setTimeout(async () => {
            try {
              const response = await fetch('/api/export_custom_excel', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({ type: reportType })
              });
              
              if(response.ok){
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `تقرير_${reportName}_${new Date().toISOString().slice(0,10)}.xlsx`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                window.URL.revokeObjectURL(url);
                
                // تحديث الرسالة
                const lastMessage = globalChatWindow.lastElementChild;
                if(lastMessage && lastMessage.querySelector('.bubble.ai')){
                  lastMessage.querySelector('.bubble.ai').textContent = `✅ تم إنشاء ${reportName} بنجاح!\n\n📁 تم تحميل الملف تلقائياً إلى جهازك.\n\n💡 يمكنك فتح الملف الآن لمراجعة البيانات.`;
                }
              } else {
                throw new Error('فشل في إنشاء التقرير');
              }
            } catch (error) {
              const lastMessage = globalChatWindow.lastElementChild;
              if(lastMessage && lastMessage.querySelector('.bubble.ai')){
                lastMessage.querySelector('.bubble.ai').textContent = `❌ حدث خطأ في إنشاء التقرير.\n\n🔧 يرجى المحاولة مرة أخرى أو الاتصال بالدعم الفني.`;
              }
            }
          }, 2000);
          
        } else if(text.includes('مساعدة') || text.includes('help') || text.includes('ماذا') || text.includes('كيف')){
          aiResponse = '🤖 كيف يمكنني مساعدتك؟\n\n';
          aiResponse += '📋 يمكنني مساعدتك في:\n';
          aiResponse += '• عرض المنتجات المنتهية الصلاحية\n';
          aiResponse += '• تحليل المنتجات ذات الكمية المنخفضة\n';
          aiResponse += '• عرض أكثر المنتجات مبيعاً\n';
          aiResponse += '• إعداد تقارير شاملة\n';
          aiResponse += '• إنشاء ملفات Excel مخصصة\n';
          aiResponse += '• إدارة المبيعات والمخزون\n\n';
          aiResponse += '💬 اسأل عن أي شيء تريد معرفته!';
      } else {
          aiResponse = '🤔 لم أفهم سؤالك تماماً. يمكنني مساعدتك في:\n\n';
          aiResponse += '• 📊 تقارير المخزون والتحليل\n';
          aiResponse += '• 🚨 المنتجات المنتهية الصلاحية\n';
          aiResponse += '• ⚠️ المنتجات ذات الكمية المنخفضة\n';
          aiResponse += '• 🔥 أكثر المنتجات مبيعاً\n';
          aiResponse += '• 📈 إدارة المبيعات\n';
          aiResponse += '• 📋 إنشاء ملفات Excel\n\n';
          aiResponse += '💡 جرب أن تسأل: "أنشئ تقرير المنتجات المنتهية الصلاحية"';
        }

        gAppendMessage(aiResponse, 'ai');
      }, 1500); // وقت التفكير المحاكي
      
    } catch (error) {
      setTimeout(() => {
        thinking.remove();
        gAppendMessage('❌ حدث خطأ في جلب البيانات. يرجى المحاولة مرة أخرى.', 'ai');
      }, 1000);
    }
  }

  globalChatForm && globalChatForm.addEventListener('submit', (e)=>{
    e.preventDefault();
    const v = globalChatInput.value.trim();
    if(!v) return;
    handleUserMessage(v);
    globalChatInput.value = '';
  });

})();

// Global functions for notification actions
window.handleNotificationAction = function(action, productId) {
  switch(action) {
    case 'remove_or_review':
      window.open(`/expired`, '_blank');
      break;
    case 'review_soon':
      window.open(`/products`, '_blank');
      break;
    case 'reorder_immediately':
      alert('يُنصح بالطلب الفوري لهذا المنتج');
      break;
    case 'consider_reorder':
      alert('يُنصح بالنظر في إعادة الطلب');
      break;
    default:
      console.log('Action:', action, 'Product ID:', productId);
  }
};

window.handlePredictionAction = function(recommendation, productId) {
  switch(recommendation) {
    case 'reorder_now':
      alert('التوصية: طلب المنتج الآن');
      break;
    case 'plan_reorder':
      alert('التوصية: تخطيط إعادة الطلب');
      break;
    case 'increase_stock':
      alert('التوصية: زيادة المخزون');
      break;
    case 'monitor_closely':
      alert('التوصية: مراقبة المنتج عن كثب');
      break;
    default:
      console.log('Recommendation:', recommendation, 'Product ID:', productId);
  }
};

// ---------- Mobile Menu Toggle ----------
(() => {
  const mobileMenuToggle = document.getElementById('mobileMenuToggle');
  const mobileDropdown = document.getElementById('mobileDropdown');
  const hamburger = document.querySelector('.hamburger');

  if (!mobileMenuToggle || !mobileDropdown) return;

  function toggleMobileMenu() {
    const isOpen = !mobileDropdown.classList.contains('hidden');
    if (isOpen) {
      mobileDropdown.classList.add('hidden');
      hamburger.classList.remove('active');
    } else {
      mobileDropdown.classList.remove('hidden');
      hamburger.classList.add('active');
    }
  }

  function closeMobileMenu() {
    mobileDropdown.classList.add('hidden');
    hamburger.classList.remove('active');
  }

  mobileMenuToggle.addEventListener('click', toggleMobileMenu);

  // Close menu when clicking on links
  mobileDropdown.addEventListener('click', (e) => {
    if (e.target.tagName === 'A') {
      closeMobileMenu();
    }
  });

  // Close menu when clicking outside
  document.addEventListener('click', (e) => {
    if (!mobileMenuToggle.contains(e.target) && !mobileDropdown.contains(e.target)) {
      closeMobileMenu();
    }
  });

  // Mobile buttons trigger desktop ones
  const notificationsToggleMobile = document.getElementById('notificationsToggleMobile');
  const chatToggleMobile = document.getElementById('chatToggleMobile');
  const notificationsToggle = document.getElementById('notificationsToggle');
  const chatToggle = document.getElementById('chatToggle');

  if (notificationsToggleMobile && notificationsToggle) {
    notificationsToggleMobile.addEventListener('click', () => {
      notificationsToggle.click();
      closeMobileMenu();
    });
  }

  if (chatToggleMobile && chatToggle) {
    chatToggleMobile.addEventListener('click', () => {
      chatToggle.click();
      closeMobileMenu();
    });
  }
})();
