void function main() {
    $("#jaxfarm_address").html(addresses.jaxFarming);
    $("#contract_address").html(shortenAddress(addresses.jaxFarming));
    $("#amountIn").on('input', check_status);
}()

function shortenAddress(address) {
    return address.substr(0, 8) + "..." + address.substr(34);
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

async function get_user_farms() {
    if(is_disconnected()) return;
    if(table_updating) return;
    table_updating = true;
    try{
        let contract = new web3.eth.Contract(abis.jaxFarming, addresses.jaxFarming);
        let ids = await callSmartContract(contract, "get_farm_ids", [accounts[0]]);
        $("#farms").empty();
        let new_table_data = await Promise.all(ids.map(id => callSmartContract(contract, "stake_list", [id])));
        new_table_data = new_table_data.map((each, i) => Object.assign(each, {id: ids[i]}));
        new_table_data.forEach( row => render_farm(row));
        
    } catch(e) {}
    table_updating = false;
}

function render_farm({}) {
    return `
        <div class="border border-radius p-3 text-grey text-left mb-3">
            <h4 class="text-yellow pb-2">Farm 1 
                <small>
                    <span class="alert-warning rounded px-2 py-1 float-right" style="font-size: 12px;">Ended</span>
                </small>
            </h4>
            <p class="text-blue text-normal pb-0 mb-1">My Stake</p>
            <h4 class="text-blue mb-3">0.21345688 Cake LP</h4>
            <p class="text-blue text-normal pb-0 mb-1">Earned Yield</p>
            <h4 class="text-blue">0.11111 HST</h4>
            <p class="">
                <a href="#" class="btn btn-light btn1" data-toggle="modal" data-target="#exampleModalXl">
                    Details
                </a>
            </p>
            <p class="text-blue text-normal pb-0 mb-1">
                Withdrawl date is: 14 April 2022, 20:26:05
            </p>
        </div>
    `
}

function is_disconnected() {
    if(typeof accounts == "undefined") return true;
    if(accounts.length == 0) return true;
    return false;
}