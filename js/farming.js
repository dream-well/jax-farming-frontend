const RPC_URL = "https://data-seed-prebsc-1-s1.binance.org:8545/";
const states = {yields: {}};
let table_updating = false;
let table_data = [];

void function main() {
    $("#jaxfarm_address").html(addresses.jaxFarming);
    $("#contract_address").html(shortenAddress(addresses.jaxFarming));
    $("#amountIn").on('input', check_status);
    get_apy_today();
    get_reward_pool();
    get_total_staked();
    setInterval(update_withdrawal_date, 1000);
    update_withdrawal_date();
    setInterval(update_reward_info(), 10000);
}()

function shortenAddress(address) {
    return address.substr(0, 6) + "..." + address.substr(36);
}

async function stake_LP(btn) {
    let amount = $("#amount_LP").val();
    amount = parseUnit(amount, 18);
    if(amount == 0) return;
    btn.disabled = true;
    const contract = new web3.eth.Contract(abis.jaxFarming, addresses.jaxFarming);
    await runContract(contract, "create_farm", [amount], {
        confirmationTitle: "Depositing WJXN/BUSD LP",
        pendingTitle: "Stake WJXN/BUSD LP"
    });
    btn.disabled = false;
    get_user_farms();
}

async function stake_BUSD(btn) {
    let amount = $("#amount_BUSD").val();
    amount = parseUnit(amount, 18);
    if(amount == 0) return;
    btn.disabled = true;
    const contract = new web3.eth.Contract(abis.jaxFarming, addresses.jaxFarming);
    await runContract(contract, "create_farm_busd", [amount], {
        confirmationTitle: "Depositing BUSD",
        pendingTitle: "Stake BUSD"
    });
    btn.disabled = false;
    get_user_farms();
}

async function check_status() {
    if(accounts.length == 0) {
        $(".btn_connects").show();
        $("#btn_approve_lp").hide();
        $("#btn_stake_lp").hide();
        $("#btn_approve_busd").hide();
        $("#btn_stake_busd").hide();
        return;
    }
    $(".btn_connects").hide();
    get_user_farms();
    get_total_staked();
    let busd = new web3.eth.Contract(abis.erc20, addresses.busd);
    let lpToken = new web3.eth.Contract(abis.erc20, addresses.lpToken);
    let [allowance1, allowance2] = await Promise.all([
        await callSmartContract(
            busd,
            "allowance", 
            [accounts[0], addresses.jaxFarming]
        ),
        await callSmartContract(
            lpToken,
            "allowance", 
            [accounts[0], addresses.jaxFarming]
        )
    ]);
    
    allowance1 = formatUnit(allowance1, 18);
    allowance2 = formatUnit(allowance2, 18);
    let amountBUSD = $("#amount_BUSD").val();
    let amountLP = $("#amount_LP").val();
    if(allowance1 == 0 || (amountBUSD && allowance1 < amountBUSD)) {
        $("#btn_approve_BUSD").show();
        $("#btn_stake_BUSD").hide();
    }
    else {
        $("#btn_approve_BUSD").hide();
        $("#btn_stake_BUSD").show();
    }
    
    if(allowance2 == 0 || (amountLP && allowance2 < amountLP)) {
        $("#btn_approve_LP").show();
        $("#btn_stake_LP").hide();
    }
    else {
        $("#btn_approve_LP").hide();
        $("#btn_stake_LP").show();
    }

    $("#balance_BUSD").html(await get_balance(busd, 18));
    $("#balance_LP").html(await get_balance(lpToken, 18, 18));
}
    

function accountChanged() {
    check_status();
}

async function approve_LP(btn) {
    let contract = new web3.eth.Contract(abis.erc20, addresses.lpToken);
    btn.disabled = true;
    await approve_token("BUSD/WJXN LpToken", contract, addresses.jaxFarming);
    btn.disabled = false;
    check_status();
}

async function approve_BUSD(btn) {
    let contract = new web3.eth.Contract(abis.erc20, addresses.busd);
    btn.disabled = true;
    await approve_token("BUSD", contract, addresses.jaxFarming);
    btn.disabled = false;
    check_status();
}

async function select_max_balance_LP() {
    let lpToken = new web3.eth.Contract(abis.erc20, addresses.lpToken);
    let balance = await get_balance(lpToken, 18, 18);
    $("#amount_LP").val(balance);
    check_status();
}

async function select_max_balance_BUSD() {
    let busd = new web3.eth.Contract(abis.erc20, addresses.busd);
    let balance = await get_balance(busd, 18);
    $("#amount_BUSD").val(balance);
    check_status();
}

async function get_user_farms() {
    if(is_disconnected()) return;
    if(table_updating) return;
    table_updating = true;
    get_wjxn_price();
    try{
        let contract = new web3.eth.Contract(abis.jaxFarming, addresses.jaxFarming);
        let ids = await callSmartContract(contract, "get_farm_ids", [accounts[0]]);
        let new_table_data = await Promise.all(ids.map(id => callSmartContract(contract, "farms", [id])));
        const current_timestamp = (new Date()).getTime() / 1000;
        new_table_data = new_table_data.map((each, i) => Object.assign(each, 
            {
                id: ids[i],
                is_locked: parseInt(each.end_timestamp) > current_timestamp
            }
        ))
        .map(each => Object.assign(each, { is_unlocked: !each.is_locked && !each.is_withdrawn }));
        // table_data = new_table_data.reverse();
        table_data = new_table_data.sort((a, b) => {
            if(a.is_unlocked && !b.is_unlocked)
                return -1;
            if(!a.is_unlocked && b.is_unlocked)
                return 1;
            if(a.is_unlocked && b.is_unlocked) 
                return parseInt(a.end_timestamp) > parseInt(b.end_timestamp) ? -1: 1;
            if(a.is_locked && !b.is_locked)
                return -1;
            if(!a.is_locked && b.is_locked)
                return 1;
            if(a.is_locked && b.is_locked) 
                return parseInt(a.end_timestamp) > parseInt(b.end_timestamp) ? 1: -1;
            return parseInt(a.end_timestamp) > parseInt(b.end_timestamp) ? -1: 1;
        })
        render_table();
    }catch(e) {

    }
    table_updating = false;
}

function filter_table_data() {
    const filterType = parseInt($("#filter").val());
    switch(filterType) {
        case 0:
            return table_data;
        case 1: // ACTIVE
            return table_data.filter(each => each.is_locked);
        case 2: // ENDED
            return table_data.filter(each => each.is_unlocked);
        case 3: // WITHDRAWN
            return table_data.filter(each => each.is_withdrawn);
    }
}

function render_table() {
    $("#results .table_row").remove();
    filter_table_data().forEach( row => add_row(row));
    update_reward_info();
}

function add_row(row) {
    var html = `
        <div class="table_row">
            <div class="table_small order-1">
            <div class="table_cell">Stake Option</div>
            <div class="table_cell text-blue">
                <div>${formatUnit(row.lp_amount, 18, 18)}</div>
                <div>$ ${formatUnit(row.busd_amount, decimals.busd, 2)}</div>
            </div>
            </div>
            <div class="table_small order-2">
            <div class="table_cell">APY</div>
            <div class="table_cell">${myFixed(formatUnit(row.reward_percentage,8,3) * 3, 3)}%</div>
            </div>
            <div class="table_small order-3" style="width: 340px">
            <div class="table_cell">Yield in HST(Estimated)</div>
            <div class="table_cell d-flex flex-column" style="justify-content: space-between;">
                <div class="pb-2">
                    <span class="text-success" id="yield_busd_${row.id}">${states.yields[row.id] ? states.yields[row.id].busd : 0}</span> BUSD
                    <br>
                    <div style="font-size:85%">
                    Estimated HST: <span class="text-success" id="yield_hst_${row.id}">${states.yields[row.id] ? states.yields[row.id].hst : 0}</span> HST
                    </div>
                </div>
                <button onclick="harvest(${row.id}, this)" class="btn btn-warning" style="display:${states.yields[row.id] && states.yields[row.id].busd > 0 ? "" : "none"};width:120px" id="collect_${row.id}" >Collect</button>
            </div>
            </div>
            <div class="table_small order-4" style="width:300px">
            <div class="table_cell">Status</div>
            <div class="table_cell">
                <a class="btn" data-toggle="collapse" href="#stake_${row.id}" role="button" aria-expanded="false"
                aria-controls="stake_${row.id}"><i class="fas fa-chevron-down"></i></a>
                <span class="alert-${row.is_locked ? "danger" : (row.is_withdrawn ? "warning" : "success")} py-1 px-2 border-radius">
                    ${row.is_locked ? "Locked" : (row.is_withdrawn ? "Withdrawn" : "Unlocked")}
                </span>
                <!--- Extra content--->
        
                <div class="collapse" id="stake_${row.id}" style="font-size: 12px;">
                <div class="row">
                    <div class="col-12">
                    <div class="text-blue">
                        <div class="row justify-content-around">
                        <div class="col-12 text-md-left extra">
                            <p class="pt-2 pb-0 mb-0"><strong>Deposit date:</strong> ${(new Date(row.start_timestamp * 1000).toLocaleString())}</p>
                            <p class="pb-0 mb-0"><strong>Withdrawal date:</strong> ${(new Date(row.end_timestamp * 1000).toLocaleString())}</p>
                            <p class=""><strong>Total reward:</strong> ${formatUnit(row.total_reward, decimals.busd, 2)} BUSD</p>
                            <p class="pb-0 mb-0" style="display:${(!row.is_locked && !row.is_withdrawn) ? "" : "none"}">
                                <button class="btn btn-info mb-1 mb-md-0" onclick="withdraw(${row.id}, this)">Withdraw</button>
                                <button class="btn btn-info mb-1 mb-md-0" onclick="restake(${row.id}, this)">Restake</button>
                            </p>
                        </div>
        
                        </div>
        
                    </div>
                    </div>
                </div>
                </div>
        
                <!--- Extra content--->
            </div>
            </div>
        </div>
    `
    $("#results").append(html);
}

function update_reward_info() {
    if(is_disconnected()) return;
    filter_table_data().forEach( row => update_row(row));
}

function update_row(row) {
    if(row.is_withdrawn) return;
    const contract = new web3.eth.Contract(abis.jaxFarming, addresses.jaxFarming);
    callSmartContract(contract, "get_pending_reward", [row.id])
        .then(reward => {
            reward = formatUnit(reward, decimals.busd, 2);
            const reward_in_hst = parseInt(reward * 1e8 / states.wjxn_price);
            $(`#yield_busd_${row.id}`).html(reward);
            $(`#yield_hst_${row.id}`).html(reward_in_hst);
            states.yields[row.id] = {busd: reward, hst: reward_in_hst};
            if(reward > 0) $(`#collect_${row.id}`).show();
            else $(`#collect_${row.id}`).hide();
        })
}

function is_disconnected() {
    if(typeof accounts == "undefined") return true;
    if(accounts.length == 0) return true;
    return false;
}

async function get_apy_today() {
    const web3 = new Web3(RPC_URL);
    const contract = new web3.eth.Contract(abis.jaxFarming, addresses.jaxFarming);
    let apy = await callSmartContract(contract, "get_apy_today", []);
    apy = formatUnit(apy, 8);
    $("#apy_today").html(apy * 3 + "%" + "  " +"APR");
}

async function get_reward_pool() {
    const web3 = new Web3(RPC_URL);
    const contract = new web3.eth.Contract(abis.erc20, addresses.hst);
    let hst_balance = await callSmartContract(contract, "balanceOf", [addresses.jaxFarming]);
    $("#hst_balance").html(hst_balance);
    await get_wjxn_price();
    $("#hst_balance_usd").html("$ " + parseInt((hst_balance / 1e8) * states.wjxn_price * 100) / 100)
}

async function get_total_staked() {
    const web3 = new Web3(RPC_URL);
    const contract = new web3.eth.Contract(abis.lpToken, addresses.lpToken);
    let [total_liquidity, total_staked, reserves, token0] = await Promise.all([
        callSmartContract(contract, "totalSupply", []),
        callSmartContract(contract, "balanceOf", [addresses.jaxFarming]),
        callSmartContract(contract, "getReserves", []),
        callSmartContract(contract, "token0", [])
    ]);
    let busd_reserve = reserves[token0 == addresses.busd ? 0 : 1];
    $("#total_staked").html(formatUnit(total_staked, 18, 18));
    $("#total_staked_usd").html("$ " + 2 * formatUnit(BN(total_staked).mul(BN(busd_reserve)).div(BN(total_liquidity)).toString(), decimals.busd, 2));
}

function update_withdrawal_date() {
    const withdrawal_date = new Date();
    withdrawal_date.setTime(withdrawal_date.getTime() + 120 * 24 * 3600 * 1000);
    $(".withdrawal_date").html(withdrawal_date.toLocaleString());
}



async function withdraw(stake_id, btn) {
    if(is_disconnected()) return;
    btn.disabled = true;
    const contract = new web3.eth.Contract(abis.jaxFarming, addresses.jaxFarming);
    await runContract(contract, "withdraw", [stake_id], {
        confirmationTitle: "Withdraw",
        pendingTitle: "Withdraw"
    });
    btn.disabled = false;
    check_status();
    get_user_farms();
}

async function restake(stake_id, btn) {
    if(is_disconnected()) return;
    btn.disabled = true;
    const contract = new web3.eth.Contract(abis.jaxFarming, addresses.jaxFarming);
    await runContract(contract, "restake", [stake_id], {
        confirmationTitle: "Restake",
        pendingTitle: "Restake"
    });
    btn.disabled = false;
    check_status();
    get_user_farms();
}

async function harvest(stake_id, btn) {
    if(is_disconnected()) return;
    btn.disabled = true;
    const contract = new web3.eth.Contract(abis.jaxFarming, addresses.jaxFarming);
    await runContract(contract, "harvest", [stake_id], {
        confirmationTitle: "Harvest",
        pendingTitle: "Harvest"
    });
    btn.disabled = false;
    check_status();
    get_user_farms();
}


async function get_wjxn_price() {
    let _web3 = web3;
    if(is_disconnected())
        _web3 = new Web3(RPC_URL);
    const jaxFarming = new _web3.eth.Contract(abis.jaxFarming, addresses.jaxFarming);
    const lpToken = new _web3.eth.Contract(abis.lpToken, addresses.lpToken);
    let [minimum_wjxn_price, reserves, token0] = await Promise.all([
        callSmartContract(jaxFarming, "minimum_wjxn_price", []),
        callSmartContract(lpToken, "getReserves", []),
        callSmartContract(lpToken, "token0", [])
    ]);
    minimum_wjxn_price = formatUnit(minimum_wjxn_price, 18);
    let wjxn_amount;
    let busd_amount;
    if(token0 == addresses.wjxn) {
        wjxn_amount = formatUnit(reserves[0], 0);
        busd_amount = formatUnit(reserves[1], decimals.busd);
    }
    else {
        wjxn_amount = formatUnit(reserves[1], 0);
        busd_amount = formatUnit(reserves[0], decimals.busd);
    }
    let wjxn_price = busd_amount / wjxn_amount;
    if(minimum_wjxn_price > wjxn_price)
        wjxn_price = minimum_wjxn_price;
    states.wjxn_price = wjxn_price;
    return wjxn_price;
}