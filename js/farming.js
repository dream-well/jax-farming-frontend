const RPC_URL = "https://data-seed-prebsc-1-s1.binance.org:8545/";
const states = {};

void function main() {
    $("#jaxfarm_address").html(addresses.jaxFarming);
    $("#contract_address").html(shortenAddress(addresses.jaxFarming));
    $("#amountIn").on('input', check_status);
    get_apy_today();
    get_reward_pool();
    get_total_staked();
    setInterval(update_withdrawal_date, 1000);
    update_withdrawal_date();
}()

function shortenAddress(address) {
    return address.substr(0, 6) + "..." + address.substr(36);
}

async function stake_LP() {
    let amount = $("#amount_LP").val();
    amount = parseUnit(amount, 18);
    if(amount == 0) return;
    const contract = new web3.eth.Contract(abis.jaxFarming, addresses.jaxFarming);
    runContract(contract, "create_farm", [amount], {
        confirmationTitle: "Depositing WJXN/BUSD LP",
        pendingTitle: "Stake WJXN/BUSD LP"
    });
}

async function stake_BUSD() {
    let amount = $("#amount_BUSD").val();
    amount = parseUnit(amount, 18);
    if(amount == 0) return;
    const contract = new web3.eth.Contract(abis.jaxFarming, addresses.jaxFarming);
    runContract(contract, "create_farm_busd", [amount], {
        confirmationTitle: "Depositing BUSD",
        pendingTitle: "Stake BUSD"
    });
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

async function approve_LP() {
    let contract = new web3.eth.Contract(abis.erc20, addresses.lpToken);
    await approve_token("BUSD/WJXN LpToken", contract, addresses.jaxFarming);
    check_status();
}

async function approve_BUSD() {
    let contract = new web3.eth.Contract(abis.erc20, addresses.busd);
    await approve_token("BUSD", contract, addresses.jaxFarming);
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

let table_updating = false;
let table_data = [];

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
                is_active: parseInt(each.end_timestamp) > current_timestamp
            }
        ));
        table_data = new_table_data.reverse();
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
            return table_data.filter(each => each.is_active);
        case 2: // ENDED
            return table_data.filter(each => !each.is_active && !each.is_withdrawn);
        case 3: // WITHDRAWN
            return table_data.filter(each => each.is_withdrawn);
    }
}

function render_table() {
    $("#results .table_row").remove();
    filter_table_data().forEach( row => add_row(row));
}

function add_row(row) {
    var html = `
        <div class="table_row">
            <div class="table_small order-5">
            <div class="table_cell">Status</div>
            <div class="table_cell">
                <a class="btn" data-toggle="collapse" href="#stake_${row.id}" role="button" aria-expanded="false"
                aria-controls="stake_${row.id}"><i class="fas fa-chevron-down"></i></a>
                <span class="alert-${row.is_active ? "success" : (row.is_withdrawn ? "warning" : "danger")} py-1 px-2 border-radius">
                    ${row.is_active ? "Active" : (row.is_withdrawn ? "Withdrawn" : "Ended")}
                </span>
                <!--- Extra content--->
        
                <div class="collapse" id="stake_${row.id}" style="font-size: 12px;">
                <div class="row">
                    <div class="col-12">
                    <div class="text-blue">
                        <div class="row justify-content-around">
                        <div class="col-12 text-md-left extra">
                            <p class="pb-0 mb-0"><strong>Deposit date:</strong> ${(new Date(row.start_timestamp * 1000).toLocaleString())}</p>
                            <p class="pb-0 mb-0"><strong>Total reward:</strong> ${formatUnit(row.total_reward, decimals.busd, 2)} BUSD</p>
                            <p class=""><strong>Withdrawal date:</strong> ${(new Date(row.end_timestamp * 1000).toLocaleString())}</p>
                            <p class="pb-0 mb-0" style="display:${(!row.is_active && !row.is_withdrawn) ? "" : "none"}">
                                <button class="btn btn-info mb-1 mb-md-0" onclick="withdraw(${row.id})">Withdraw</button>
                                <button class="btn btn-info mb-1 mb-md-0" onclick="restake(${row.id})">Restake</button>
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
            <div class="table_small order-2">
            <div class="table_cell">Stake Option</div>
            <div class="table_cell text-blue"><span>${formatUnit(row.lp_amount, 18, 10)}</span></div>
            </div>
            <div class="table_small order-3">
            <div class="table_cell">Amount</div>
            <div class="table_cell">${formatUnit(row.busd_amount, decimals.busd)} BUSD</div>
            </div>
            <div class="table_small order-4">
            <div class="table_cell">APY</div>
            <div class="table_cell">${myFixed(formatUnit(row.reward_percentage,8,3) * 3, 3)}%</div>
            </div>
            <div class="table_small order-5">
            <div class="table_cell">Yield in BUSD</div>
            <div class="table_cell">
                <span class="text-success" id="yield_busd_${row.id}">0</span> BUSD
            </div>
            </div>
            <div class="table_small order-6">
            <div class="table_cell">Yield in HST(Estimated)</div>
            <div class="table_cell">
                <span class="text-success" id="yield_hst_${row.id}">0</span> HST
                <button onclick="harvest(${row.id})" class="btn btn-warning" style="display:none" id="collect_${row.id}" >Collect</button>
            </div>
            </div>
        </div>
    `
    $("#results").append(html);
    if(row.is_withdrawn) return;
    const contract = new web3.eth.Contract(abis.jaxFarming, addresses.jaxFarming);
    callSmartContract(contract, "get_pending_reward", [row.id])
        .then(reward => {
            reward = formatUnit(reward, decimals.busd, 2);
            const reward_in_hst = parseInt(reward * 1e8 / states.wjxn_price);
            $(`#yield_busd_${row.id}`).html(reward);
            $(`#yield_hst_${row.id}`).html(reward_in_hst);
            if(reward > 0) $(`#collect_${row.id}`).show();
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
    $("#apy_today").html(apy + "%");
}

async function get_reward_pool() {
    const web3 = new Web3(RPC_URL);
    const contract = new web3.eth.Contract(abis.erc20, addresses.hst);
    let hst_balance = await callSmartContract(contract, "balanceOf", [addresses.jaxFarming]);
    $("#hst_balance").html(hst_balance);
}

async function get_total_staked() {
    const web3 = new Web3(RPC_URL);
    const contract = new web3.eth.Contract(abis.erc20, addresses.lpToken);
    let total_staked = await callSmartContract(contract, "balanceOf", [addresses.jaxFarming]);
    $("#total_staked").html(formatUnit(total_staked, 18, 10));
}

function update_withdrawal_date() {
    const withdrawal_date = new Date();
    withdrawal_date.setTime(withdrawal_date.getTime() + 120 * 24 * 3600 * 1000);
    $(".withdrawal_date").html(withdrawal_date.toLocaleString());
}



async function withdraw(stake_id) {
    if(is_disconnected()) return;
    const contract = new web3.eth.Contract(abis.jaxFarming, addresses.jaxFarming);
    await runContract(contract, "withdraw", [stake_id], {
        confirmationTitle: "Withdraw",
        pendingTitle: "Withdraw"
    });
    check_status();
    get_user_farms();
}

async function restake(stake_id) {
    if(is_disconnected()) return;
    const contract = new web3.eth.Contract(abis.jaxFarming, addresses.jaxFarming);
    await runContract(contract, "restake", [stake_id], {
        confirmationTitle: "Restake",
        pendingTitle: "Restake"
    });
    check_status();
    get_user_farms();
}

async function harvest(stake_id) {
    if(is_disconnected()) return;
    const contract = new web3.eth.Contract(abis.jaxFarming, addresses.jaxFarming);
    await runContract(contract, "harvest", [stake_id], {
        confirmationTitle: "Harvest",
        pendingTitle: "Harvest"
    });
    check_status();
    get_user_farms();
}


async function get_wjxn_price() {
    const jaxFarming = new web3.eth.Contract(abis.jaxFarming, addresses.jaxFarming);
    const lpToken = new web3.eth.Contract(abis.lpToken, addresses.lpToken);
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