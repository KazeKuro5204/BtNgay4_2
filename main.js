// Viết bằng JavaScript - code đơn giản, rõ ràng
// Dashboard tương tác: fetch products, search, sort, pagination, export CSV, view/edit modal, create modal

const API = 'https://api.escuelajs.co/api/v1/products';
let products = []; // toàn bộ dữ liệu lấy từ API
let filtered = []; // sau search + sort
let page = 1;
let pageSize = 10;
let searchTerm = '';
let sortField = null; // 'title' | 'price'
let sortDir = 1; // 1 asc, -1 desc

// Element references
const tbody = document.getElementById('tbody');
const pagination = document.getElementById('pagination');
const pageSizeSelect = document.getElementById('pageSizeSelect');
const searchInput = document.getElementById('searchInput');
const sortTitleBtn = document.getElementById('sortTitle');
const sortPriceBtn = document.getElementById('sortPrice');
const exportBtn = document.getElementById('exportBtn');

// View modal controls and image helpers
const editBtn = document.getElementById('editBtn');
const deleteBtn = document.getElementById('deleteBtn');
const viewMainImage = document.getElementById('viewMainImage');
const viewThumbs = document.getElementById('viewThumbs');

// Confirm delete modal & toast container
const confirmModalEl = document.getElementById('confirmModal');
const confirmModal = new bootstrap.Modal(confirmModalEl);
let pendingDeleteId = null;
const confirmYesBtn = document.getElementById('confirmYesBtn');

const toastContainer = document.getElementById('toastContainer');

let isEditing = false;
let currentProduct = null;

function showToast(message, type = 'info'){
  const id = 't' + Date.now();
  const color = type === 'success' ? 'bg-success text-white' : (type === 'error' ? 'bg-danger text-white' : 'bg-secondary text-white');
  const html = `
    <div id="${id}" class="toast ${color}" role="alert" aria-live="assertive" aria-atomic="true">
      <div class="d-flex">
        <div class="toast-body">${escapeHtml(message)}</div>
        <button type="button" class="btn-close btn-close-white ms-auto me-2" data-bs-dismiss="toast" aria-label="Close"></button>
      </div>
    </div>`;
  toastContainer.insertAdjacentHTML('beforeend', html);
  const el = document.getElementById(id);
  const b = new bootstrap.Toast(el, { delay: 4000 });
  b.show();
  el.addEventListener('hidden.bs.toast', ()=> el.remove());
}

function testImage(url){
  return new Promise(resolve=>{
    const img = new Image();
    img.onload = ()=> resolve(true);
    img.onerror = ()=> resolve(false);
    img.src = url;
  });
}

async function pickValidImage(images){
  for(const s of (images || [])){
    if(!s) continue;
    const candidates = s.startsWith('http:') ? [s.replace(/^http:/,'https:'), s] : [s];
    for(const c of candidates){
      if(await testImage(c)) return c;
    }
  }
  return null;
}

async function resolveImageUrl(url){
  if(!url) return null;
  const candidates = url.startsWith('http:') ? [url.replace(/^http:/,'https:'), url] : [url];
  for(const c of candidates){
    if(await testImage(c)) return c;
  }
  return null;
}

// Modals
const viewModalEl = document.getElementById('viewModal');
const viewModal = new bootstrap.Modal(viewModalEl);
const editForm = document.getElementById('editForm');
const editId = document.getElementById('editId');
const editTitle = document.getElementById('editTitle');
const editPrice = document.getElementById('editPrice');
const editDescription = document.getElementById('editDescription');
const editImages = document.getElementById('editImages');
const editCategoryId = document.getElementById('editCategoryId');
const saveEditBtn = document.getElementById('saveEditBtn');

const createModalEl = document.getElementById('createModal');
const createModal = new bootstrap.Modal(createModalEl);
const createForm = document.getElementById('createForm');
const createTitleEl = document.getElementById('createTitle');
const createPriceEl = document.getElementById('createPrice');
const createDescriptionEl = document.getElementById('createDescription');
const createImagesEl = document.getElementById('createImages');
const createCategoryIdEl = document.getElementById('createCategoryId');
const saveCreateBtn = document.getElementById('saveCreateBtn');

// Fetch dữ liệu ban đầu
async function loadProducts(){
  try{
    const res = await fetch(API);
    const data = await res.json();
    products = Array.isArray(data) ? data : [];
    // Build category dropdowns from loaded products
    buildCategoryOptions();
    applyFilters();
  }catch(e){
    alert('Lỗi khi tải dữ liệu: ' + e.message);
  }
}

function buildCategoryOptions(){
  const map = new Map();
  products.forEach(p=>{
    if(p.category && p.category.id != null){
      map.set(p.category.id, p.category.name || (`Category ${p.category.id}`));
    }
  });
  const createSel = document.getElementById('createCategoryId');
  const editSel = document.getElementById('editCategoryId');
  [createSel, editSel].forEach(sel=>{
    if(!sel) return;
    sel.innerHTML = '<option value="">-- Chọn category --</option>';
    for(const [id,name] of map){
      const opt = document.createElement('option');
      opt.value = id;
      opt.textContent = name;
      sel.appendChild(opt);
    }
  });
}

// Áp dụng search + sort
function applyFilters(){
  // search
  const term = searchTerm.trim().toLowerCase();
  filtered = products.filter(p => p.title.toLowerCase().includes(term));
  // sort
  if(sortField){
    filtered.sort((a,b)=>{
      let va = a[sortField];
      let vb = b[sortField];
      if(sortField === 'title'){
        va = String(va).toLowerCase();
        vb = String(vb).toLowerCase();
        if(va < vb) return -1 * sortDir;
        if(va > vb) return 1 * sortDir;
        return 0;
      }
      // price
      return (Number(va) - Number(vb)) * sortDir;
    });
  }
  // render
  renderTable();
  renderPagination();
}

function renderTable(){
  tbody.innerHTML = '';
  const start = (page - 1) * pageSize;
  const pageItems = filtered.slice(start, start + pageSize);

  for(const p of pageItems){
    const tr = document.createElement('tr');
    tr.setAttribute('data-id', p.id);
    // dùng tooltip để hiển thị description khi hover
    tr.setAttribute('data-bs-toggle', 'tooltip');
    tr.setAttribute('title', p.description || '');

    const catName = p.category?.name ?? '';
    const imgId = `img_${p.id}`;
    const imgHtml = `<img id="${imgId}" src="" class="thumb rounded d-none" />`;

    const actionHtml = `<button class="btn btn-sm btn-danger btn-delete" data-id="${p.id}">Delete</button>`;

    tr.innerHTML = `
      <td>${p.id}</td>
      <td>${escapeHtml(p.title)}</td>
      <td>${p.price}</td>
      <td>${escapeHtml(catName)}</td>
      <td>${imgHtml}</td>
      <td>${actionHtml}</td>
    `;

    // click mở modal detail
    tr.addEventListener('click', ()=> openViewModal(p.id));
    tbody.appendChild(tr);

    // attach delete handler (stop event propagation so row click doesn't fire)
    const delBtn = tr.querySelector('.btn-delete');
    if(delBtn){
      delBtn.addEventListener('click', (e)=>{
        e.stopPropagation();
        pendingDeleteId = Number(delBtn.getAttribute('data-id'));
        confirmModal.show();
      });
    }

    // thử tìm ảnh hợp lệ cho row (async)
    (async ()=>{
      if(p.images && p.images.length){
        try{
          const valid = await pickValidImage(p.images);
          const imgEl = document.getElementById(imgId);
          if(valid && imgEl){
            imgEl.src = valid;
            imgEl.classList.remove('d-none');
          }
        }catch(e){ console.debug('image check error', e); }
      }
    })();
  }

  // init bootstrap tooltips cho các hàng
  const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
  tooltipTriggerList.forEach(function (tooltipTriggerEl) {
    // eslint-disable-next-line no-new
    new bootstrap.Tooltip(tooltipTriggerEl);
  });
}

function renderPagination(){
  pagination.innerHTML = '';
  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const prevLi = document.createElement('li');
  prevLi.className = 'page-item' + (page === 1 ? ' disabled' : '');
  prevLi.innerHTML = `<a class="page-link" href="#">Previous</a>`;
  prevLi.addEventListener('click', (e)=>{ e.preventDefault(); if(page>1){ page--; applyFilters(); } });
  pagination.appendChild(prevLi);

  // show up to 7 page numbers
  const startPage = Math.max(1, page - 3);
  const endPage = Math.min(totalPages, startPage + 6);
  for(let i = startPage; i <= endPage; i++){
    const li = document.createElement('li');
    li.className = 'page-item' + (i === page ? ' active' : '');
    li.innerHTML = `<a class="page-link" href="#">${i}</a>`;
    li.addEventListener('click', (e)=>{ e.preventDefault(); page = i; applyFilters(); });
    pagination.appendChild(li);
  }

  const nextLi = document.createElement('li');
  nextLi.className = 'page-item' + (page === totalPages ? ' disabled' : '');
  nextLi.innerHTML = `<a class="page-link" href="#">Next</a>`;
  nextLi.addEventListener('click', (e)=>{ e.preventDefault(); if(page<totalPages){ page++; applyFilters(); } });
  pagination.appendChild(nextLi);
}

// helpers
function escapeHtml(text){
  if(!text) return '';
  return text.replace(/&/g, '&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// Events
searchInput.addEventListener('input', (e)=>{
  searchTerm = e.target.value;
  page = 1;
  applyFilters();
});

pageSizeSelect.addEventListener('change', (e)=>{
  pageSize = Number(e.target.value);
  page = 1;
  renderPagination();
  renderTable();
});

sortTitleBtn.addEventListener('click', ()=>{
  if(sortField === 'title') sortDir = -sortDir; else { sortField = 'title'; sortDir = 1; }
  applyFilters();
  sortTitleBtn.textContent = sortDir===1 ? '↑' : '↓';
  sortPriceBtn.textContent = '↕';
});

sortPriceBtn.addEventListener('click', ()=>{
  if(sortField === 'price') sortDir = -sortDir; else { sortField = 'price'; sortDir = 1; }
  applyFilters();
  sortPriceBtn.textContent = sortDir===1 ? '↑' : '↓';
  sortTitleBtn.textContent = '↕';
});

exportBtn.addEventListener('click', ()=>{
  exportCSVCurrentView();
});

// Open view modal and fill data
async function openViewModal(id){
  const p = products.find(x=>x.id === id);
  if(!p) return;
  currentProduct = p;
  isEditing = false;
  editId.value = p.id;
  editTitle.value = p.title;
  editPrice.value = p.price;
  editDescription.value = p.description || '';
  editImages.value = (p.images || []).join(' | ');
  editCategoryId.value = p.category?.id || '';

  // disable inputs initially
  [editTitle, editPrice, editDescription, editImages, editCategoryId].forEach(el=> el.setAttribute('disabled','disabled'));
  saveEditBtn.disabled = true;
  editBtn.textContent = 'Edit';

  // images
  viewMainImage.src = '';
  viewThumbs.innerHTML = '';
  if(p.images && p.images.length){
    const main = await pickValidImage(p.images);
    if(main) viewMainImage.src = main;
    for(const url of p.images){
      const valid = await resolveImageUrl(url);
      if(valid){
        const t = document.createElement('img');
        t.src = valid;
        t.className = 'thumb rounded';
        t.style.width = '60px';
        t.style.height = '40px';
        t.style.cursor = 'pointer';
        t.addEventListener('click', ()=> { viewMainImage.src = valid; });
        viewThumbs.appendChild(t);
      }
    }
  }

  viewModal.show();
}

// Update product via API
saveEditBtn.addEventListener('click', async ()=>{
  if(!isEditing){
    // bật chế độ edit nếu chưa bật
    editBtn.click();
    return;
  }
  const id = editId.value;
  const imagesArr = (editImages.value || '').split('|').map(s=>s.trim()).filter(Boolean);
  if(imagesArr.length === 0){
    showToast('Vui lòng nhập ít nhất 1 URL vào trường Images', 'error');
    return;
  }
  const body = {
    title: editTitle.value,
    price: Number(editPrice.value),
    description: editDescription.value,
    images: imagesArr,
    categoryId: editCategoryId.value ? Number(editCategoryId.value) : undefined
  };

  try{
    const res = await fetch(`${API}/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if(!res.ok){
      const text = await res.text();
      throw new Error('Update failed: ' + text);
    }
    const updated = await res.json();
    // update local products array
    const idx = products.findIndex(x=>x.id === updated.id);
    if(idx !== -1) products[idx] = updated;
    buildCategoryOptions();
    applyFilters();
    showToast('Cập nhật thành công', 'success');
    isEditing = false;
    editBtn.textContent = 'Edit';
    saveEditBtn.disabled = true;
    [editTitle, editPrice, editDescription, editImages, editCategoryId].forEach(el=> el.setAttribute('disabled','disabled'));
    viewModal.hide();
  }catch(e){
    showToast('Lỗi khi cập nhật: ' + e.message, 'error');
  }
});

// Create product
saveCreateBtn.addEventListener('click', async ()=>{
  const imagesArr = (createImagesEl.value || '').split('|').map(s=>s.trim()).filter(Boolean);
  if(imagesArr.length === 0){
    showToast('Vui lòng nhập ít nhất 1 URL vào trường Images', 'error');
    return;
  }
  const body = {
    title: createTitleEl.value,
    price: Number(createPriceEl.value),
    description: createDescriptionEl.value,
    images: imagesArr,
    categoryId: createCategoryIdEl.value ? Number(createCategoryIdEl.value) : undefined
  };
  try{
    const res = await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if(!res.ok){
      const text = await res.text();
      throw new Error('Create failed: ' + text);
    }
    const created = await res.json();
    // update local products array to show immediately
    products.unshift(created);
    buildCategoryOptions();
    applyFilters();
    showToast('Tạo thành công', 'success');
    createModal.hide();
    createForm.reset();
  }catch(e){
    showToast('Lỗi khi tạo: ' + e.message, 'error');
  }
});

// Edit toggle
editBtn.addEventListener('click', ()=>{
  if(!currentProduct) return;
  if(!isEditing){
    isEditing = true;
    editBtn.textContent = 'Hủy';
    saveEditBtn.disabled = false;
    [editTitle, editPrice, editDescription, editImages, editCategoryId].forEach(el=> el.removeAttribute('disabled'));
  }else{
    // hủy edit, khôi phục giá trị
    isEditing = false;
    editBtn.textContent = 'Edit';
    saveEditBtn.disabled = true;
    editTitle.value = currentProduct.title;
    editPrice.value = currentProduct.price;
    editDescription.value = currentProduct.description || '';
    editImages.value = (currentProduct.images || []).join(' | ');
    editCategoryId.value = currentProduct.category?.id || '';
    [editTitle, editPrice, editDescription, editImages, editCategoryId].forEach(el=> el.setAttribute('disabled','disabled'));
  }
});

// Delete (via view modal)
deleteBtn.addEventListener('click', async ()=>{
  if(!currentProduct) return;
  pendingDeleteId = currentProduct.id;
  confirmModal.show();
});

// Confirm delete action (called from confirm modal)
confirmYesBtn.addEventListener('click', async ()=>{
  if(!pendingDeleteId) return;
  try{
    const res = await fetch(`${API}/${pendingDeleteId}`, { method: 'DELETE' });
    if(!res.ok){
      const text = await res.text();
      throw new Error('Delete failed: ' + text);
    }
    // update local products array
    products = products.filter(p => p.id !== pendingDeleteId);
    buildCategoryOptions();
    applyFilters();
    showToast('Xóa thành công', 'success');
    confirmModal.hide();
    viewModal.hide();
    // adjust page if necessary
    const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
    if(page > totalPages) page = totalPages;
  }catch(e){
    showToast('Lỗi khi xóa: ' + e.message, 'error');
  } finally{
    pendingDeleteId = null;
  }
});

// Export CSV của view hiện tại
function exportCSVCurrentView(){
  const start = (page - 1) * pageSize;
  const visible = filtered.slice(start, start + pageSize);
  if(visible.length === 0){ alert('Không có dữ liệu để export'); return; }
  const rows = visible.map(p => ({
    id: p.id,
    title: p.title.replace(/"/g, '""'),
    price: p.price,
    category: p.category?.name || '',
    images: (p.images || []).join(' | ')
  }));

  const header = ['id','title','price','category','images'];
  const csv = [header.join(',')].concat(rows.map(r => [r.id, `"${r.title}"`, r.price, `"${r.category}"`, `"${r.images}"`].join(','))).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `products_page${page}.csv`;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  URL.revokeObjectURL(url);
  a.remove();
}

// khởi tạo
loadProducts();

// Expose some functions for debug (optional)
window._reloadProducts = loadProducts;
