void function main() {
    $("#amountIn").on('input', check_status);
}()

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