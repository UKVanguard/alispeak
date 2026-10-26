'use strict';

/* ==========================================================================
 * alispeak —— 「爱丽丝说话」表情包生成器
 *
 * 一段话可以拆成多句，每句一个独立气泡；单句太长时，气泡内自动折行。
 *
 * 绘制思路：
 *   一个气泡 = 左端盖 + 纯色中段 + 右端盖
 *   左端盖是右端盖（盒1.jpg，25px 圆角封头）水平镜像而来，所以后续气泡没有尾巴
 *   三段都用「上带 / 中带 / 下带」纵向切片：上下各 12px 按 1:1 贴，
 *   中间 1px 纯色拉伸填充，因此气泡高度可变而圆角与边缘质感不变形
 *
 * 素材注意：超.jpg / 盒1.jpg 是 JPEG，气泡以外是奶油底色而不是透明，
 * 所有切片只能取 y=97..187 这 91 行；否则奶油色会被涂到相邻气泡上。
 *
 * 文字宽度用 measureText 实测（汉字全角、数字字母半角），不按字数估算。
 * ========================================================================== */

/* --------------------------------------------------------------------------
 * 一、版面常量（单位 px，均由原图实测得出）
 * -------------------------------------------------------------------------- */
const CANVAS_BACKGROUND = '#fdfde5';   // 素材底色（淡黄）
const TEXT_COLOR = '#ffffff';
// 桌面端用 SimHei；安卓没有这个字体，会依次回退到系统黑体。
// 气泡宽度由 measureText 实测，换字体只会改变字形，不会撑破版面。
const TEXT_FONT_FAMILY = "'SimHei', 'Noto Sans CJK SC', 'Noto Sans SC', 'Microsoft YaHei', 'PingFang SC', sans-serif";
const TEXT_FONT = '43px ' + TEXT_FONT_FAMILY;
const TEXT_LEFT = 250;                 // 文字左边界
const TEXT_BASELINE_OFFSET = 60;       // 首行基线相对气泡顶部的偏移
const LINE_HEIGHT = 58;                // 折行后的行距
const BUBBLE_PADDING_Y = 16.5;         // 单行气泡上下留白，2*16.5+58 = 91

const BUBBLE_LEFT = 204;               // 气泡本体左边缘（尾巴尖在 192）
const BUBBLE_FIRST_TOP = 97;           // 首个气泡顶部
const BUBBLE_MIN_RIGHT = 342;          // 最小右边界：保证「爱丽丝」名字不被裁掉
const BUBBLE_GAP = 24;                 // 相邻气泡的垂直间距
const BOTTOM_MARGIN = 41;              // 最后一个气泡下方留白
const RIGHT_MARGIN = 41;               // 气泡右缘到画布右缘的留白，和底部留白对齐

const RIGHT_PADDING = 48;              // 文字右缘到气泡右缘的留白
const MIN_RIGHT_PADDING = 12;          // 手动缩短时的最小留白，防止压字
const MAX_TEXT_WIDTH = 700;            // 超过这个宽度就折行（约 16 个汉字）

const CAP_WIDTH = 25;                  // 盒1.jpg 里圆角封头的宽度
const BODY_SLICE_WIDTH = 8;            // 超.jpg 的纯色切片宽度

const SOURCE_BUBBLE_TOP = 97;          // 素材中气泡的纵向范围
const SOURCE_BUBBLE_BOTTOM = 187;      // （含）
const SOURCE_BUBBLE_HEIGHT = 91;
const SOURCE_TOP_BAND = 20;            // 上带行数：必须不小于圆角半径，
const SOURCE_BOTTOM_BAND = 20;         // 否则圆角会被纵向拉伸成直边
const SOURCE_MIDDLE_ROW = 142;         // 中带取样的纯色行（此处整段都是纯色）

const AVATAR_WIDTH = 190;              // 我.jpg 中头像列的宽度（右缘在 x=168）
const NAME_CROP = { x: 190, y: 0, width: 128, height: 96 };   // 名字条
const TAIL_CROP = { x: 190, y: 118, width: 14, height: 36 };  // 尾巴片
const TAIL_OFFSET_Y = TAIL_CROP.y - SOURCE_BUBBLE_TOP;        // 尾巴相对气泡顶

const MANUAL_LENGTH_STEP = 12;         // 「框拉长 / 缩短」每次的步长
const SLIDER_CENTER = 50;              // 滑条中位对应 1 倍
const CLIPBOARD_TIMEOUT = 2000;
const EXPORT_BLOCKED_HINT = '导出失败：浏览器禁止 file:// 页面向出画布，请用本地服务器打开（见 README）';

/* --------------------------------------------------------------------------
 * 二、DOM 元素
 * -------------------------------------------------------------------------- */
const canvas = document.getElementById('canvas');
const drawingContext = canvas.getContext('2d');

const inputList = document.getElementById('inputs');
const addButton = document.getElementById('add');
const resetButton = document.getElementById('reset');
const saveButton = document.getElementById('save');
const copyButton = document.getElementById('copy');
const shareButton = document.getElementById('share');
const lengthenButton = document.getElementById('long');
const shortenButton = document.getElementById('short');
const lengthSlider = document.getElementById('range');
const lengthNumberInput = document.getElementById('rangenum');
const statusLabel = document.getElementById('status');
const activeHint = document.getElementById('active-hint');

/* --------------------------------------------------------------------------
 * 三、素材图片
 * -------------------------------------------------------------------------- */
const leftPanelImage = new Image();   // 我.jpg：头像 + 名字 + 气泡左半 + 尾巴
const bubbleBodyImage = new Image();  // 超.jpg：8px 纯色切片
const bubbleCapImage = new Image();   // 盒1.jpg：25px 圆角封头

/* --------------------------------------------------------------------------
 * 四、运行状态
 * -------------------------------------------------------------------------- */
const rowStates = [];    // { wrap, input, offset, scale }
let activeRowIndex = 0;
let statusTimer = 0;

/* --------------------------------------------------------------------------
 * 五、文字排版
 * -------------------------------------------------------------------------- */
const NO_LINE_START = '，。、；：？！）】》」』”’%…·,.;:?!)]}>';   // 不能出现在行首
const LATIN_WORD_PATTERN = /[A-Za-z0-9@#$&*+=/\-_~^]/;

/** 把文字切成「拉丁词 / 单个字符」两类 token。 */
function tokenizeText(text) {
  const tokens = [];
  let buffer = '';
  for (const char of text) {
    if (LATIN_WORD_PATTERN.test(char)) {
      buffer += char;
    } else {
      if (buffer) {
        tokens.push(buffer);
        buffer = '';
      }
      tokens.push(char);
    }
  }
  if (buffer) {
    tokens.push(buffer);
  }
  return tokens;
}

/** 单个 token 本身就超宽时，按字符硬切。 */
function splitOversizedToken(context, token, maxWidth) {
  const pieces = [];
  let piece = '';
  for (const char of token) {
    if (piece && context.measureText(piece + char).width > maxWidth) {
      pieces.push(piece);
      piece = char;
    } else {
      piece += char;
    }
  }
  if (piece) {
    pieces.push(piece);
  }
  return pieces;
}

/**
 * 按实际排版宽度折行。
 * 汉字可逐字断行，英文按单词断行，并避免标点落在行首。
 */
function wrapText(context, text, maxWidth) {
  context.font = TEXT_FONT;
  if (!text) {
    return [''];
  }

  const tokens = [];
  tokenizeText(text).forEach(function (token) {
    if (context.measureText(token).width > maxWidth) {
      splitOversizedToken(context, token, maxWidth).forEach(function (piece) {
        tokens.push(piece);
      });
    } else {
      tokens.push(token);
    }
  });

  const lines = [];
  let current = '';
  tokens.forEach(function (token) {
    if (token === ' ' || token === '　') {
      if (current) {
        current += token;
      }
      return;
    }
    if (!current) {
      current = token;
      return;
    }
    if (context.measureText(current + token).width <= maxWidth) {
      current += token;
      return;
    }
    if (NO_LINE_START.indexOf(token) !== -1) {
      // 标点悬挂在行尾，避免孤零零出现在下一行开头
      lines.push(current + token);
      current = '';
      return;
    }
    lines.push(current);
    current = token;
  });
  if (current) {
    lines.push(current);
  }
  return lines.length ? lines : [''];
}

/**
 * 在保持行数不变的前提下，找出最窄的折行宽度，
 * 让各行长度尽量接近，避免末行只剩两三个字。
 */
function wrapBalanced(context, text, maxWidth) {
  context.font = TEXT_FONT;
  const greedy = wrapText(context, text, maxWidth);
  if (greedy.length <= 1) {
    return greedy;
  }
  const lineCount = greedy.length;
  const totalWidth = context.measureText(text).width;
  let low = totalWidth / lineCount;
  let high = maxWidth;
  for (let i = 0; i < 14; i++) {
    const middle = (low + high) / 2;
    if (wrapText(context, text, middle).length > lineCount) {
      low = middle;
    } else {
      high = middle;
    }
  }
  return wrapText(context, text, high);
}

/** 气泡高度：单行 91，每多一行加一个行距。 */
function bubbleHeightFor(lineCount) {
  return BUBBLE_PADDING_Y * 2 + lineCount * LINE_HEIGHT;
}

/* --------------------------------------------------------------------------
 * 六、版面计算
 * -------------------------------------------------------------------------- */
function computeLayout() {
  drawingContext.font = TEXT_FONT;

  const filledRows = rowStates.filter(function (row) {
    return row.input.value.trim() !== '';
  });
  // 全部为空时保留一个最小气泡，避免画布变成空白
  const renderRows = filledRows.length ? filledRows : [rowStates[0]];

  const blocks = [];
  let top = BUBBLE_FIRST_TOP;

  renderRows.forEach(function (row) {
    const text = row.input.value;
    const naturalWidth = drawingContext.measureText(text).width;
    const lines = naturalWidth > MAX_TEXT_WIDTH
      ? wrapBalanced(drawingContext, text, MAX_TEXT_WIDTH)
      : [text];

    const lineWidths = lines.map(function (line) {
      return drawingContext.measureText(line).width;
    });
    const maxLineWidth = Math.max.apply(null, lineWidths.concat([0]));

    // 气泡宽度：在实测文字宽度基础上叠加手动缩放与位移
    const desired = TEXT_LEFT + maxLineWidth * row.scale + RIGHT_PADDING + row.offset;
    // 但不能窄到压住文字，也不能窄到裁掉名字
    const floor = Math.max(BUBBLE_MIN_RIGHT, Math.ceil(TEXT_LEFT + maxLineWidth + MIN_RIGHT_PADDING));
    const right = Math.max(floor, Math.ceil(desired));

    const height = bubbleHeightFor(lines.length);
    blocks.push({ top: top, height: height, right: right, lines: lines });
    top += height + BUBBLE_GAP;
  });

  const contentRight = blocks.reduce(function (widest, block) {
    return Math.max(widest, block.right);
  }, 0);
  // 画布比气泡多留一条右边距，否则气泡圆角直接切在画布边缘上，看着像被裁掉了
  const width = Math.max(contentRight + RIGHT_MARGIN, NAME_CROP.x + NAME_CROP.width);
  const lastBlock = blocks[blocks.length - 1];
  const height = lastBlock.top + lastBlock.height + BOTTOM_MARGIN;

  return { blocks: blocks, width: width, height: height };
}

/* --------------------------------------------------------------------------
 * 七、绘制
 * -------------------------------------------------------------------------- */

/**
 * 把气泡素材沿纵向拉伸到指定高度。
 * 上下两带 1:1 贴（保留圆角与 JPEG 软边），中间只取 1px 纯色行拉长。
 */
function drawStretchableSlice(context, image, sourceX, sourceWidth,
                             destX, destY, destWidth, destHeight) {
  if (destHeight < SOURCE_TOP_BAND + SOURCE_BOTTOM_BAND) {
    context.drawImage(image, sourceX, SOURCE_BUBBLE_TOP, sourceWidth, SOURCE_BUBBLE_HEIGHT,
      destX, destY, destWidth, destHeight);
    return;
  }
  const middleHeight = destHeight - SOURCE_TOP_BAND - SOURCE_BOTTOM_BAND;

  // 上带
  context.drawImage(image, sourceX, SOURCE_BUBBLE_TOP, sourceWidth, SOURCE_TOP_BAND,
    destX, destY, destWidth, SOURCE_TOP_BAND);
  // 中带：1px 纯色纵向拉伸
  context.drawImage(image, sourceX, SOURCE_MIDDLE_ROW, sourceWidth, 1,
    destX, destY + SOURCE_TOP_BAND, destWidth, middleHeight);
  // 下带
  context.drawImage(image,
    sourceX, SOURCE_BUBBLE_BOTTOM - SOURCE_BOTTOM_BAND + 1, sourceWidth, SOURCE_BOTTOM_BAND,
    destX, destY + destHeight - SOURCE_BOTTOM_BAND, destWidth, SOURCE_BOTTOM_BAND);
}

/** 画一个气泡：左端盖（镜像）+ 中段 + 右端盖。 */
function drawBubble(context, block) {
  const top = block.top;
  const height = block.height;
  const right = block.right;

  // 左端盖：把右端封头水平翻转
  context.save();
  context.translate(BUBBLE_LEFT + CAP_WIDTH, top);
  context.scale(-1, 1);
  drawStretchableSlice(context, bubbleCapImage, 0, CAP_WIDTH,
    0, 0, CAP_WIDTH, height);
  context.restore();

  // 中段
  const bodyLeft = BUBBLE_LEFT + CAP_WIDTH - 1;
  const bodyRight = right - CAP_WIDTH + 1;
  if (bodyRight > bodyLeft) {
    drawStretchableSlice(context, bubbleBodyImage, 0, BODY_SLICE_WIDTH,
      bodyLeft, top, bodyRight - bodyLeft, height);
  }

  // 右端盖
  drawStretchableSlice(context, bubbleCapImage, 0, CAP_WIDTH,
    right - CAP_WIDTH, top, CAP_WIDTH, height);
}

/** 头像与名字只属于第一行，来自 我.jpg 的两块裁切。 */
function drawAvatarAndName(context) {
  context.drawImage(leftPanelImage,
    0, 0, AVATAR_WIDTH, leftPanelImage.naturalHeight,
    0, 0, AVATAR_WIDTH, leftPanelImage.naturalHeight);
  context.drawImage(leftPanelImage,
    NAME_CROP.x, NAME_CROP.y, NAME_CROP.width, NAME_CROP.height,
    NAME_CROP.x, NAME_CROP.y, NAME_CROP.width, NAME_CROP.height);
}

/** 第一句气泡左侧的小尾巴。 */
function drawTail(context, firstBlockTop) {
  context.drawImage(leftPanelImage,
    TAIL_CROP.x, TAIL_CROP.y, TAIL_CROP.width, TAIL_CROP.height,
    BUBBLE_LEFT - TAIL_CROP.width, firstBlockTop + TAIL_OFFSET_Y,
    TAIL_CROP.width, TAIL_CROP.height);
}

/** 把整张表情图画到画板上。画板尺寸即导出尺寸。 */
function renderCanvas() {
  const layout = computeLayout();

  if (canvas.width !== layout.width || canvas.height !== layout.height) {
    canvas.width = layout.width;
    canvas.height = layout.height;
  }

  drawingContext.fillStyle = CANVAS_BACKGROUND;
  drawingContext.fillRect(0, 0, layout.width, layout.height);

  drawAvatarAndName(drawingContext);

  drawingContext.font = TEXT_FONT;
  drawingContext.fillStyle = TEXT_COLOR;
  drawingContext.textBaseline = 'alphabetic';

  layout.blocks.forEach(function (block, index) {
    drawBubble(drawingContext, block);
    if (index === 0) {
      drawTail(drawingContext, block.top);
    }
    block.lines.forEach(function (line, lineIndex) {
      drawingContext.fillText(
        line,
        TEXT_LEFT,
        block.top + TEXT_BASELINE_OFFSET + lineIndex * LINE_HEIGHT
      );
    });
  });
}

/* --------------------------------------------------------------------------
 * 八、导出与剪贴板
 * -------------------------------------------------------------------------- */
function buildFileName() {
  const first = rowStates.map(function (row) {
    return row.input.value.trim();
  }).filter(Boolean)[0] || '';
  const safeName = first.replace(/[\\/:*?"<>|]/g, '_').slice(0, 60);
  return safeName ? safeName + '.png' : 'alispeak.png';
}

function downloadCanvas(blobOrUrl, fileName) {
  const downloadLink = document.createElement('a');
  downloadLink.download = fileName;
  downloadLink.href = blobOrUrl;
  downloadLink.click();
}

/**
 * 安卓壳通过 addJavascriptInterface 注入的原生桥。
 * 浏览器里没有它，所有逻辑会自动走原来的 Web 实现。
 */
function getNativeBridge() {
  return (typeof window.NativeBridge !== 'undefined' && window.NativeBridge) ? window.NativeBridge : null;
}

/** 调原生方法，返回空字符串表示成功，否则是给用户看的失败原因。 */
function callBridge(bridge, method, dataUrl) {
  if (!bridge || typeof bridge[method] !== 'function') {
    return '当前环境不支持该操作';
  }
  try {
    return bridge[method](dataUrl) || '';
  } catch (error) {
    console.warn('原生调用失败：', error);
    return String(error && error.message ? error.message : error);
  }
}

/** 画板转 PNG Blob；file:// 打开时画布被污染，转成可读提示。 */
function canvasToPngBlob() {
  return new Promise(function (resolve, reject) {
    try {
      canvas.toBlob(function (blob) {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('导出 PNG 失败'));
        }
      }, 'image/png');
    } catch (error) {
      reject(new Error(EXPORT_BLOCKED_HINT));
    }
  });
}

function saveImage() {
  const bridge = getNativeBridge();
  if (bridge) {
    const failure = callBridge(bridge, 'savePng', canvas.toDataURL('image/png'));
    showStatus(failure ? '保存失败：' + failure : '已保存到相册');
    return;
  }
  try {
    downloadCanvas(canvas.toDataURL('image/png'), buildFileName());
    showStatus('已保存图片');
  } catch (error) {
    console.warn('导出图片失败：', error);
    showStatus(EXPORT_BLOCKED_HINT);
  }
}

/** 分享：只有安卓壳里才有，浏览器不显示这个按钮。 */
function shareImage() {
  const bridge = getNativeBridge();
  if (!bridge) {
    return;
  }
  const failure = callBridge(bridge, 'sharePng', canvas.toDataURL('image/png'));
  showStatus(failure ? '分享失败：' + failure : '');
}

/** 写入系统剪贴板；安卓走原生桥，浏览器走 Clipboard API。 */
async function copyImage() {
  const bridge = getNativeBridge();
  if (bridge) {
    const failure = callBridge(bridge, 'copyPng', canvas.toDataURL('image/png'));
    if (failure) {
      throw new Error(failure);
    }
    return;
  }

  if (!navigator.clipboard || typeof ClipboardItem === 'undefined') {
    throw new Error('当前浏览器不支持向剪贴板写入图片');
  }
  const pngBlob = await canvasToPngBlob();

  const writePromise = navigator.clipboard.write([
    new ClipboardItem({ 'image/png': pngBlob })
  ]);
  writePromise.catch(function () { /* 交给下面的 race 统一处理 */ });

  await Promise.race([
    writePromise,
    new Promise(function (_resolve, reject) {
      window.setTimeout(function () {
        reject(new Error('写入剪贴板超时'));
      }, CLIPBOARD_TIMEOUT);
    })
  ]);
}

/* --------------------------------------------------------------------------
 * 九、界面提示
 * -------------------------------------------------------------------------- */
function showStatus(message) {
  if (!statusLabel) {
    return;
  }
  statusLabel.textContent = message;
  window.clearTimeout(statusTimer);
  statusTimer = window.setTimeout(function () {
    statusLabel.textContent = '';
  }, 4000);
}

/* --------------------------------------------------------------------------
 * 十、多句输入框
 * -------------------------------------------------------------------------- */
function createRow(text) {
  const wrap = document.createElement('div');
  wrap.className = 'phrase-row';

  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'phrase-input';
  input.value = text || '';

  const removeButton = document.createElement('button');
  removeButton.type = 'button';
  removeButton.className = 'remove-row';
  removeButton.title = '删除这一句';
  removeButton.textContent = '×';

  wrap.appendChild(input);
  wrap.appendChild(removeButton);

  const state = { wrap: wrap, input: input, removeButton: removeButton, offset: 0, scale: 1 };

  input.addEventListener('focus', function () {
    setActiveRow(rowStates.indexOf(state));
  });
  input.addEventListener('input', function () {
    setActiveRow(rowStates.indexOf(state));
    renderCanvas();
  });
  removeButton.addEventListener('click', function () {
    removeRow(rowStates.indexOf(state));
  });

  rowStates.push(state);
  inputList.appendChild(wrap);
  renumberRows();
  return state;
}

function renumberRows() {
  rowStates.forEach(function (state, index) {
    state.input.placeholder = '第 ' + (index + 1) + ' 句…';
  });
}

function setActiveRow(index) {
  if (index < 0 || index >= rowStates.length) {
    return;
  }
  activeRowIndex = index;
  rowStates.forEach(function (state, i) {
    state.wrap.classList.toggle('is-active', i === index);
  });
  if (activeHint) {
    activeHint.textContent = '（第 ' + (index + 1) + ' 句）';
  }
  syncLengthControls();
}

function addRow() {
  const state = createRow('');
  setActiveRow(rowStates.length - 1);
  state.input.focus();
}

function removeRow(index) {
  if (index < 0 || index >= rowStates.length) {
    return;
  }
  if (rowStates.length === 1) {
    rowStates[0].input.value = '';
    rowStates[0].offset = 0;
    rowStates[0].scale = 1;
    setActiveRow(0);
    syncLengthControls();
    renderCanvas();
    return;
  }
  const state = rowStates[index];
  inputList.removeChild(state.wrap);
  rowStates.splice(index, 1);
  renumberRows();
  setActiveRow(Math.min(index, rowStates.length - 1));
  renderCanvas();
}

/* --------------------------------------------------------------------------
 * 十一、长度微调（作用于当前选中的那一句）
 * -------------------------------------------------------------------------- */
function syncLengthControls() {
  const row = rowStates[activeRowIndex];
  if (!row) {
    return;
  }
  const sliderValue = Math.max(0, Math.min(100, Math.round(SLIDER_CENTER + (row.scale - 1) * 100)));
  if (lengthSlider) {
    lengthSlider.value = sliderValue;
  }
  if (lengthNumberInput) {
    lengthNumberInput.value = sliderValue;
  }
}

function applyScale(value) {
  const row = rowStates[activeRowIndex];
  if (!row) {
    return;
  }
  const clamped = Math.min(100, Math.max(0, value));
  row.scale = 1 + (clamped - SLIDER_CENTER) / 100;
  row.offset = 0;
  syncLengthControls();
  renderCanvas();
}

function nudgeLength(step) {
  const row = rowStates[activeRowIndex];
  if (!row) {
    return;
  }
  row.offset += step;
  renderCanvas();
}

/* --------------------------------------------------------------------------
 * 十二、事件绑定
 * -------------------------------------------------------------------------- */
function bindEvents() {
  addButton.addEventListener('click', addRow);

  resetButton.addEventListener('click', function () {
    while (rowStates.length > 1) {
      const state = rowStates.pop();
      inputList.removeChild(state.wrap);
    }
    rowStates[0].input.value = '';
    rowStates[0].offset = 0;
    rowStates[0].scale = 1;
    renumberRows();
    setActiveRow(0);
    renderCanvas();
    showStatus('已重置');
  });

  lengthenButton.addEventListener('click', function () {
    nudgeLength(MANUAL_LENGTH_STEP);
  });
  shortenButton.addEventListener('click', function () {
    nudgeLength(-MANUAL_LENGTH_STEP);
  });

  lengthSlider.addEventListener('input', function (event) {
    applyScale(Number(event.target.value));
  });
  lengthNumberInput.addEventListener('input', function (event) {
    applyScale(Number(event.target.value) || 0);
  });

  saveButton.addEventListener('click', saveImage);

  if (shareButton) {
    shareButton.addEventListener('click', shareImage);
  }

  copyButton.addEventListener('click', async function () {
    try {
      await copyImage();
      showStatus('图片已复制到剪贴板');
    } catch (error) {
      console.warn('写入剪贴板失败：', error);
      try {
        downloadCanvas(canvas.toDataURL('image/png'), buildFileName());
        showStatus('当前环境无法写入剪贴板，已改为下载图片');
      } catch (downloadError) {
        console.warn('下载图片失败：', downloadError);
        showStatus(EXPORT_BLOCKED_HINT);
      }
    }
  });
}

/* --------------------------------------------------------------------------
 * 十三、素材加载与启动
 * -------------------------------------------------------------------------- */
/**
 * 按候选文件名依次尝试加载。
 * 网页里素材是中文名；打进 APK 时 aapt2 处理不了中文文件名，
 * 构建脚本会改名成 left/body/cap.jpg，这里自动回退，两边共用同一份代码。
 */
function loadFirstAvailable(image, candidates) {
  return new Promise(function (resolve) {
    let index = 0;

    function tryNext() {
      if (index >= candidates.length) {
        console.error('素材加载失败：' + candidates.join(' / '));
        resolve();
        return;
      }
      const path = candidates[index];
      index += 1;

      image.onload = function () {
        // decode() 保证首帧绘制用的是完整解码后的图，避免画到半张
        if (typeof image.decode === 'function') {
          image.decode().catch(function () { /* 解码失败也继续 */ }).then(resolve);
        } else {
          resolve();
        }
      };
      image.onerror = tryNext;
      image.src = path;
    }

    tryNext();
  });
}

async function loadSourceImages() {
  const sources = [
    { image: leftPanelImage, candidates: ['我.jpg', 'left.jpg'] },
    { image: bubbleBodyImage, candidates: ['超.jpg', 'body.jpg'] },
    { image: bubbleCapImage, candidates: ['盒1.jpg', 'cap.jpg'] }
  ];
  await Promise.all(sources.map(function (source) {
    return loadFirstAvailable(source.image, source.candidates);
  }));
}

/** 「分享」只在安卓壳里出现，浏览器没有原生分享就不显示这个按钮。 */
function revealNativeOnlyControls() {
  const bridge = getNativeBridge();
  if (shareButton && bridge && typeof bridge.sharePng === 'function') {
    shareButton.hidden = false;
  }
}

/**
 * 等字体就绪再画第一帧。
 * 否则 measureText 会先用回退字体的度量，等真字体加载完文字换行、气泡宽度就对不上了。
 */
async function ensureFontReady() {
  if (!document.fonts || typeof document.fonts.load !== 'function') {
    return;
  }
  try {
    await document.fonts.load(TEXT_FONT);
  } catch (error) {
    console.warn('字体预加载失败：', error);
  }
}

async function init() {
  createRow('');
  setActiveRow(0);
  bindEvents();
  revealNativeOnlyControls();
  await ensureFontReady();
  renderCanvas();
  await loadSourceImages();
  renderCanvas();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
