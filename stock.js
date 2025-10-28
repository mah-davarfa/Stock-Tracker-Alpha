
const qs =(sel, root=document)=> root.querySelector(sel);
const qsa =(sel, root=document)=>[...root.querySelectorAll(sel)];

/////variables from input
let alphaKey = '';
let lastSymbol = '';

///grab elemnts which need to display the results,
const panel    = qs("#appear-after-search");
const nameEl   = qs("#sr-name");
const timeEl   = qs("#sr-time");
const openEl   = qs("#sr-open");
const closeEl  = qs("#sr-close");
const highEl   = qs("#sr-high");
const lowEl    = qs("#sr-low");
const priceEl  = qs("#sr-price");
const diffEl   = qs("#sr-diff");
const diffPEl  = qs("#sr-diffp");
const volEl    = qs("#sr-volume");
const statusEl = qs('#app-status');
const errorEl  = qs('#app-error');

const totalPortfolioValueEl = qs('#kpi-portfolio-value');
const totalStocksOwnedEl = qs('#kpi-stocks-owned');
const shareToBuyInput = qs('#buy-count');
const shareToSellInput = qs('#sell-count');
const updateStockBtn = qs('#btn-update-shares');
const positionValueEl = qs('#position-value');
const quickSearchBtns = qsa(".quick-search [data-symbol]");
const symbolForm = qs("#search-form");
const currentStockUpdatedEl = qs("#current-stock-information");
const managePortfolioStockH1El = qs(".manage-portfolio");
const managePortfolioEl = qs("#manage-portfolio");
const stockNameInManagment = qs('h2.manage-portfolio');
const watchlistTbody = qs('#watchlist-rows');
const portfolioTbody = qs('#portfolio-rows');
const logoutBtn = qs('#btn-logout');

const buttons = qsa('button');
buttons.forEach((btn)=>{
  btn.addEventListener('click', ()=>{
    clearTimeout(timeOutStatusId);
    clearTimeout(timeOutErrorId);
  })
})

let totalValue = 0;
let owned = 0;
let dataForWatchlist=null;
let dataForRendering=null;
let selectedSymbol = null; //use to identiy any stock has been addede to manage portfolio section//
// symbol -> number of shares (source of truth for positions)
const holdings = new Map(); // we are creating: holding = {symbol1 {shares,lastPrice,lastUpdated}, symbol2 {shares,lastPrice,lastUpdated},...}
const watchlistHoldings = new Map();


//  helpers
const fmtMoney = n => Number.isFinite(n) ? n.toFixed(2) : '0.00';
const getPriceFromRow = tr =>
  parseFloat(tr.querySelector('[data-col="price"]').textContent.replace(/[^\d.]/g,'')) || 0;

//error status
let timeOutStatusId= null;

function setStatus(msg=''){ 
  if (timeOutStatusId) clearTimeout(timeOutStatusId);

  statusEl.textContent = msg;
  timeOutStatusId = setTimeout(()=>{
    statusEl.textContent='';
   timeOutStatusId = null; 
  },2500)
 }

 let timeOutErrorId=null;

function setError(msg=''){ 
  if(timeOutErrorId) clearTimeout(timeOutErrorId);
  errorEl.textContent = msg;
  timeOutErrorId= setTimeout(()=>{
    errorEl.textContent='';
    timeOutErrorId=null;
  },3000)
}

//getting apikey from input
const apikeyForm =qs("#apikey-form");
apikeyForm.addEventListener("submit", (e)=>{
    e.preventDefault();
    alphaKey = qs("#apikey").value.trim();
});
//disabling button 
function setBusy(busy){
  document.body.classList.toggle('is-busy', busy);
  qsa('button').forEach(b => b.disabled = busy);
}

///////////////////////////////////////////////////
///add to watch list button
const addWatchListBt = qs('#btn-add-watchlist');
addWatchListBt.addEventListener('click', () => {
  if (!dataForWatchlist || !dataForWatchlist.symbol) 
    { setStatus('Search a stock first before adding to watchlist.'); return;} 
  addToWatchlist(dataForWatchlist);
 
});

function addToWatchlist (data){
   const {symbol, close, difference} = data;
   watchlistHoldings.set(symbol, { close, difference });
   saveWatchlist();
   renderWatchlistRow({ symbol, close, difference });
}
//function to add the current stock data to watchlist table
//watchlist is table,each stock that need to be identifies by symbol with dataset attribute,
function renderWatchlistRow({symbol, close, difference}){
    

   
   
   //check if the stock is already in the watchlist
    let tr = watchlistTbody.querySelector(`tr[data-symbol="${symbol}"]`);
    if (!tr){
    tr = document.createElement('tr');
    tr.setAttribute('data-symbol', symbol);
    tr.innerHTML = `
    <th scope="row" data-col="symbol">${symbol}</th>
      <td data-col="price">$${fmtMoney(close)}</td>
      <td data-col="change">${fmtMoney(difference)}</td>
      <td data-col="shares">0</td>
      <td data-col="total">$0.00</td>
      <td data-col="actions">
       <button type="button" class="btn-manage" aria-label="Manage ${symbol}">Manage</button>
      </td>
    `;
    watchlistTbody.appendChild(tr);
    }else{ //tr was exested meaning need to be uopdated
      tr.querySelector('[data-col="price"]').textContent =`$${fmtMoney(close)}`;
      tr.querySelector('[data-col="change"]').textContent =`${fmtMoney(difference)}`;
    }
  }



////function to add /update portfolio table
function addOrUpdatePortfolioRow({ symbol, close, difference, shares }){

   
   let tr = portfolioTbody.querySelector(`tr[data-symbol="${symbol}"]`);
  if (!tr) {
    tr = document.createElement('tr');
    tr.setAttribute('data-symbol', symbol);
    tr.innerHTML = `
      <th scope="row" data-col="symbol">${symbol}</th>
      <td data-col="price">$${fmtMoney(close)}</td>
      <td data-col="change">${fmtMoney(difference)}</td>
      <td data-col="shares">${shares}</td>
      <td data-col="total">$${fmtMoney(shares * close)}</td>
      <td data-col="actions"><button type="button" class="btn-manage">Manage</button></td>
    `;
    portfolioTbody.appendChild(tr);
  } else {
    tr.querySelector('[data-col="price"]').textContent  = `$${fmtMoney(close)}`;
    tr.querySelector('[data-col="change"]').textContent = fmtMoney(difference);
    tr.querySelector('[data-col="shares"]').textContent = String(shares);
    tr.querySelector('[data-col="total"]').textContent  = `$${fmtMoney(shares * close)}`;  
  }


}

/////functionality for each button on table rows /portfolio/watchlist identify by symbol
function loadManagementFor(symbol){
    selectedSymbol= symbol;
///find a row portfoli/watchlist
    let tr = portfolioTbody.querySelector(`tr[data-symbol="${symbol}"]`)    
            || watchlistTbody.querySelector(`tr[data-symbol="${symbol}"]`);
    if(!tr) return;

    stockNameInManagment.textContent = `Manage :${symbol}`;

    const sharesOwnedObj = holdings.get(symbol);
    const sharesOwned = sharesOwnedObj?.shares ?? 0;
    currentStockUpdatedEl.textContent = String(sharesOwned);

    const price = getPriceFromRow(tr) || sharesOwnedObj?.lastPrice || 0;
    positionValueEl.textContent = fmtMoney(price*sharesOwned);



}

///setup update button in manage portfolio
updateStockBtn.addEventListener('click', async()=>{
        if(!selectedSymbol) return setStatus('Click “Manage” on a stock first.'); 
        if (!alphaKey) { setStatus('Enter your Alpha Vantage API key first.'); return; }
       
        let price = 0;
        let buy =Math.max(0, parseFloat(shareToBuyInput.value)||0);
        let sell = Math.max(0, parseFloat(shareToSellInput.value)||0);
        if (buy === 0 && sell === 0) return setStatus('Select Buy or Sell first');

        const previousObj = holdings.get(selectedSymbol);
        const previousShare = previousObj?.shares ?? 0;
        const nextShare = Math.max(0, previousShare + buy - sell);
        if (sell > previousShare+buy) return setStatus("can't sell shares more than what you have");

        if (!dataForRendering || dataForRendering.symbol !== selectedSymbol) {
            await fetchAlphaStockData(selectedSymbol, alphaKey); // await = pause until it sets dataForRendering
        }
        if (!dataForRendering || dataForRendering.symbol !== selectedSymbol) {
            return setStatus("Couldn't get the latest price.");
        }
         price=dataForRendering.close; 
         const previousPrice = previousObj?.lastPrice ?? price;
         const difference = price - previousPrice;

         

    //helpers
    function confirmToSelloff(price) {
        return confirm(`Sell ALL ${selectedSymbol} at ~$${price.toFixed(2)}?`);
        }

    function confirmSellOrBuyPrice(price) {
        return confirm(`With the price: $${price}, do you want to proceed or cancel?`);
        }

    function processToSellOrBuy() {
        holdings.set(
          selectedSymbol,
          { shares: nextShare, lastPrice: price, difference, lastUpdated: dataForRendering?.date || null }
        );
         addOrUpdatePortfolioRow({
            symbol: selectedSymbol,
            close: price,
            difference,
            shares: nextShare
        });
        saveHoldings();
      }

        function resetPortfolioManagementSection() {
            shareToBuyInput.value = '0';
            shareToSellInput.value = '0';
            stockNameInManagment.textContent = 'Portfolio Management';
            currentStockUpdatedEl.textContent = '0';
            positionValueEl.textContent = '0.00';
      }
    
    
   let tradeConfirmed = false;
 if (sell===previousShare+buy)  {
                           const isItConfirm= confirmToSelloff(price);
                            if(isItConfirm){
                            const toRemove = portfolioTbody.querySelector(`tr[data-symbol="${selectedSymbol}"]`);
                            toRemove?.remove();
                            holdings.delete(selectedSymbol);
                            currentStockUpdatedEl.textContent = '0';
                            positionValueEl.textContent = '0.00';
                            tradeConfirmed = true;
                           }
                     } else{
                            if (confirmSellOrBuyPrice(price)){
                            processToSellOrBuy(); 
                            tradeConfirmed = true;
                        }
                    }
    if(tradeConfirmed) {               
  currentStockUpdatedEl.textContent = String(nextShare);
  positionValueEl.textContent = (price * nextShare).toFixed(2);                
  resetPortfolioManagementSection(); 
  saveHoldings();
  updateKpis();   
          }
}) 

////eventlistner if user click on row's button in watchlist to send ifo to manage section buy/sell

watchlistTbody.addEventListener('click', (e)=>{
    const btn = e.target.closest('.btn-manage');
    if(!btn) return;
    const tr = btn.closest('tr');
    if(!tr)return;
    const symbol = tr.getAttribute('data-symbol');
    loadManagementFor(symbol);
})

portfolioTbody.addEventListener('click', (e)=>{
    const btn = e.target.closest('.btn-manage');
    if(!btn) return;
    const tr = btn.closest('tr');
    if(!tr)return;
    const symbol = tr.getAttribute('data-symbol');
    loadManagementFor(symbol);
})

function updateKpis(){
  let totalValue = 0;
  let owned = 0;
   qsa('#portfolio-rows tr').forEach(tr=>{
    const price = getPriceFromRow(tr);
    const share = parseFloat(tr.querySelector('[data-col="shares"]').textContent)||0;
    if(share>0) owned +=1
    totalValue+= price*share;
   }) 
  totalPortfolioValueEl.textContent = `$${fmtMoney(totalValue)}`;
  totalStocksOwnedEl.textContent    = String(owned);
}

//function to render the fetched data into the DOM
  const LS_LAST_VIEWED = 'lastViewedStock';
 function renderStockData (data){
    panel.hidden = false;
    nameEl.textContent  = data.symbol;
    timeEl.textContent  = `As of: ${data.date}`;
    openEl.textContent  = ` $${data.open.toFixed(2)}`;
    closeEl.textContent = ` $${data.close.toFixed(2)}`;
    highEl.textContent  = ` $${data.high.toFixed(2)}`;
    lowEl.textContent   = ` $${data.low.toFixed(2)}`;
    priceEl.textContent = ` $${data.close.toFixed(2)}`;
    volEl.textContent   = ` ${data.volume.toLocaleString()}`;
    diffEl.textContent  = ` ${data.difference.toFixed(2)}`;
    diffPEl.textContent = ` ${data.differenceP.toFixed(2)}%`;
    localStorage.setItem(LS_LAST_VIEWED, JSON.stringify(data));
    }


// create a function: user searches via search getting symbol form
symbolForm.addEventListener('submit',(e)=>{
    e.preventDefault();

    lastSymbol = qs("#search").value.trim().toUpperCase();
    if(!alphaKey){
        setStatus("Please enter your Alpha Vantage API key first.");
        return;
    }
     if (!lastSymbol){
        setStatus("Please enter a stock symbol or company name.");
        return;
    }
    console.log("ApiKey : ", alphaKey);
        fetchAlphaStockData(lastSymbol, alphaKey);
});


/////quick search set up Select the buttons that have data-symbol attribute

quickSearchBtns.forEach((btn)=>{
    btn.addEventListener("click",()=>{
        lastSymbol = btn.dataset.symbol;
        if(!alphaKey){
            setStatus("Please enter your Alpha Vantage API key first.");
            return;
        }
        fetchAlphaStockData(lastSymbol, alphaKey);
    })
})





/////ERROR handling
    class ApiError extends Error{
        constructor(code, message){
            super(message);
            this.name ="ApiError";
            this.code = code; //INVALID_SYMBOL | RATE_LIMIT
        }
    }
    
   function extractingInformationFromData(data) {
  // Guard: ensure the expected shape
        const series = data && data["Time Series (Daily)"];
        
        if (!series){
          if (data?.["Error Message"]) {suggestTickers(lastSymbol, alphaKey); throw new ApiError(" invalid symbol or Unknown.");}
          else if (data?.Note) {throw new ApiError('RATE_LIMIT', 'API limit reached. Try again shortly.');} else{
          throw new ApiError('BAD_SHAPE', 'API limit reached,Unexpected API response.');
         }
        } 
     
        const meta   = data["Meta Data"] || {};
        const symbol = meta["2. Symbol"] || lastSymbol || ""; // <-- define symbol here

        // Choose latest trading day
        const lastRef = meta["3. Last Refreshed"];
        let latestDate = (lastRef && series[lastRef]) ? lastRef
            : Object.keys(series).sort((a, b) => b.localeCompare(a))[0];

        const bar = series[latestDate];

        const open   = Number(bar["1. open"]);
        const high   = Number(bar["2. high"]);
        const low    = Number(bar["3. low"]);
        const close  = Number(bar["4. close"]);
        const volume = Number(bar["5. volume"]);
        const difference = close - open;
        const differenceP = (difference / open) * 100;
        // Log to check
        console.log(
        `Open: ${open},
        High: ${high},
        Low: ${low},
        Close: ${close},
        Volume: ${volume},
        symbol: ${symbol},
        price: ${close},
        date of report: ${latestDate}`
        );
        
        dataForWatchlist={symbol, close, difference};
        // Return an object so we can use it later to render
        
        renderStockData({symbol, date: latestDate, open, high, low, close, volume, difference, differenceP});
        return { symbol, date: latestDate, open, high, low, close, volume, difference, differenceP };
}
  
    
  //////////////painting DOM with fetched data
 const sugestingSymboles = (dataSugestionsSymbol)=>{
     const picks = (dataSugestionsSymbol?.bestMatches || [])
    .slice(0, 5) // show up to 5 options
    .map(m => ({
      symbol:  m["1. symbol"],
      name:    m["2. name"]
    }));
    if (picks.length===0) {
        setStatus("No suggestions found for the entered symbol.");
        return;
    }
    const msg = `Unknown symbol. Did you mean:\n` +
              picks.map((p, i) => `${i+1}. ${p.symbol} — ${p.name}`).join('\n') +
              `\n\nEnter.. 1-${picks.length} to pick, or Cancel.`;
            const choice = prompt(msg);
        const idx = Number(choice) - 1;

        if (Number.isInteger(idx) && idx >= 0 && idx < picks.length) {
            lastSymbol = picks[idx].symbol;       
            fetchAlphaStockData(lastSymbol, alphaKey); // retry with the chosen symbol
  }
 } 



const fetchAlphaStockData = async (symbol, alphaKey) => {
  const endpoint =
    `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${encodeURIComponent(symbol)}&apikey=${encodeURIComponent(alphaKey)}`;
      setBusy(true)
  try {
    const response = await fetch(endpoint);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = await response.json();
    console.log("RAW JSON:", data);
    clearTimeout(timeOutErrorId);

    
   const parsed =  extractingInformationFromData(data);
   dataForRendering = parsed;
    return parsed;
  } catch (error) {
    console.error("Fetch error:", error);
    // Single user-facing message here
    setError(error.message || 'Fetch failed.');
  }finally {
    setBusy(false);
  }
  
};


/////if symbole is wrong in our error message then we fetch the data for simmilar suggested symbol
async function suggestTickers(lastSymbol, alphaKey) {
    const symbolSearchEndpoint= `https://www.alphavantage.co/query?function=SYMBOL_SEARCH&keywords=${encodeURIComponent(lastSymbol)}&apikey=${encodeURIComponent(alphaKey)}`;
    try{
            const res = await fetch(symbolSearchEndpoint);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const dataSugestionsSymbol = await res.json();
    clearTimeout(timeOutErrorId);
    sugestingSymboles(dataSugestionsSymbol);
    console.log("SUGGESTIONS RAW:", dataSugestionsSymbol);
    }catch(error){
        console.error("Fetch error:", error);
        setError(error.message || 'Fetch failed.');
    }
}


///localStorages  Array.from(holdigs) = [[symbol, {shares,lastPrice,lastUpdated}], ...]
function saveHoldings(){
    localStorage.setItem('holdings', JSON.stringify(Array.from(holdings)));
}

function loadHoldings (){
    const raw= localStorage.getItem('holdings');
    if(!raw) return;
    try{
        const arr = JSON.parse(raw); //we get back:[[symbol, {shares,lastPrice,lastUpdated}], ...]
        holdings.clear();
        for (const [k,v] of arr)holdings.set(k,v);// arr.forEach(([k,v])=>holdings.set(k,v));
        
    }catch(error){
        console.warn('noting to get from localstorage',error);
    }
} 
 


function saveWatchlist (){
  localStorage.setItem('watchlistHoldings', JSON.stringify(Array.from(watchlistHoldings)));
}

function loadWatchlistHoldings(){
  const rawWatchlist = localStorage.getItem('watchlistHoldings');
  if(!rawWatchlist)return;

  try{
    const arryWatchlist = JSON.parse(rawWatchlist);
    watchlistHoldings.clear();
    for (const[k,v]of arryWatchlist) watchlistHoldings.set(k,v);

  }catch(re){
    console.warn('nothing to get for wachlist from localStorag ')
}}

//{symbol, close, difference} = data;
function rebuildWatchlist (){

  watchlistTbody.innerHTML='';

  watchlistHoldings.forEach((item,symbol)=>{
    renderWatchlistRow({
      symbol,
      close:item.close,
      difference:item.difference

    })
  })
}

function rebuildPortfolioFromholdings(){
    //{ symbol, close, difference, shares }){
   //holdings(symbol, { shares, lastPrice: close, lastUpdated: dataForRendering?.date || null })
    portfolioTbody.innerHTML = ''
    holdings.forEach((item,symbol)=>{
        addOrUpdatePortfolioRow({ 
            symbol,
            close:item?.lastPrice ?? 0,
            difference:item?.difference ?? 0,
            shares:item?.shares ?? 0
            })
        })
        updateKpis();
    }

function rePaintLastViewedStock (){
  let cached = localStorage.getItem(LS_LAST_VIEWED)
  if(!cached) return;
  try{
    const data = JSON.parse(cached);

    if(!data || !data.symbol ){
      localStorage.removeItem(LS_LAST_VIEWED);
      return;
    }

    renderStockData(data);

  }catch(er){
    console.warn('noting to get from localstorage',er);
    localStorage.removeItem(LS_LAST_VIEWED);
  }
}
logoutBtn?.addEventListener('click', () => {
  const ok = confirm('Log out and clear all saved data (watchlist, portfolio, last viewed)?');
  if (!ok) return;
  logoutAndReset();
});

function logoutAndReset(){
  if (timeOutStatusId) clearTimeout(timeOutStatusId);
  if (timeOutErrorId)  clearTimeout(timeOutErrorId);
  localStorage.removeItem('holdings');
  localStorage.removeItem('watchlistHoldings');
  localStorage.removeItem(LS_LAST_VIEWED);
  holdings.clear();
  watchlistHoldings.clear();
  alphaKey = '';
  lastSymbol = '';
  selectedSymbol = null;
  dataForRendering = null;
  dataForWatchlist = null;
  portfolioTbody.innerHTML = '';
  watchlistTbody.innerHTML = '';
  updateKpis(); 
   panel.hidden = true;                // hide details panel
  statusEl.textContent = '';          
  errorEl.textContent  = '';
  shareToBuyInput.value  = '0';
  shareToSellInput.value = '0';
  positionValueEl.textContent = '0.00';
  currentStockUpdatedEl.textContent = '0';
  stockNameInManagment.textContent = 'Portfolio Management';
  setStatus('You are logged out. Local data cleared.');
}

///windows uplaod
window.addEventListener('DOMContentLoaded',()=>{
  loadHoldings();
  rebuildPortfolioFromholdings();
  rePaintLastViewedStock ();
  loadWatchlistHoldings();
  rebuildWatchlist();
})