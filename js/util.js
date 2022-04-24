const MAX_UINT = "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";

function parseUnit(number, decimal = 18) {
    if(!number) number = "0";
    return BN(web3.utils.toWei(number+'')).mul(BN(10).pow(BN(decimal))).div(BN(web3.utils.toWei('1'))).toString();
}

function formatUnit(number, decimal = 18, fractionDigits = 6) {
    if(typeof number != "string") number = "0";
    if(number.length <= decimal) number = "0".repeat(decimal + 1 - number.length) + number;
    number = myFixed(Number(number.substr(0, number.length - decimal) + "." + number.substr(number.length - decimal)), fractionDigits);
    return number;
}

function callSmartContract(contract, func, args = [], options) {
    if(!contract) return false;
    if(!contract.methods[func]) return false;
    return contract.methods[func](...args).call();
}

function runSmartContract(contract, func, args = [], options) {
    if(accounts.length == 0) return false;
    if(!contract) return false;
    if(!contract.methods[func]) return false;
    const promiEvent = contract.methods[func](...args).send({ from: accounts[0] });
    promiEvent
        .then(receipt => {
            notifier.success(`Transaction Completed <br/>
                TxInfo: <a target='_blank' href='${blockExplorer('tx', receipt.transactionHash)}'>View</a>
            `, {durations: {success: 6000}});
        })
        .catch((err) => {
            if(err.message.startsWith("Internal JSON-RPC error.")) {
                err = JSON.parse(e.message.substr(24));
            }   
            notifier.warning(`Transaction Failed <br/>
                ${err.message}
            `, {durations: {success: 0}});
        })
    return promiEvent;        
}

async function estimateGas(contract, func, args = [], options) {
    try {
        const gasAmount = await contract.methods[func](...args).estimateGas({from: accounts[0]});
        return {
            success: true,
            gas: gasAmount
        }
    } catch(e) {
        if(e.message.startsWith("Internal JSON-RPC error.")) {
            e = JSON.parse(e.message.substr(24));
        }
        else if(e.message.startsWith("execution reverted")) {
            e = JSON.parse(e.message.substr(e.message.indexOf("\n")+1)).originalError;
        }
        return {
            success: false,
            gas: -1,
            message: e.message
        }
    }
}

async function approve_token(token_name, contract, spender, amount = MAX_UINT) {
    const promise = runSmartContract(contract, "approve", [spender, amount]);
    notifier.async(promise, null, null, `Approving ${token_name}`, {
        labels: {
            async: "Please wait..."
        },
        // position: window.innerWidth < 600 ? "bottom-right" : "top-right"
    });
    try{
        await promise;
    }catch(e){
        return false;
    }
    return true;
}

async function get_balance(contract, decimal, fractions) {
    let balance = -1;
    if(accounts.length) {
        balance = await callSmartContract(contract, 'balanceOf', [accounts[0]]);
        balance = formatUnit(balance, decimal ? decimal : await get_decimal(contract), fractions);
    }
    return balance;
}

async function get_decimal(contract) {
    let decimal = await callSmartContract(contract, 'decimals');
    if(decimal === false) return -1;
    return decimal;
}

async function add_token_to_metamask(address, symbol, decimals, image) {
    return await web3.currentProvider.request({
        method: 'wallet_watchAsset',
        params: {
            type: 'ERC20',
            options: {
                address,
                symbol,
                decimals,
                image,
            },
        },
    });
}


async function get_pancake_amount_out(token1, token2, amountIn) {
    if(!web3_provider) return 0;
    if(amountIn == 0) return 0;
    let amounts = await callSmartContract(
        contracts_provider.pancakeRouter,
        "getAmountsOut",
        [amountIn, [token1, token2]]
    );
    return amounts[1];
}

async function get_pancake_amount_in(token1, token2, amountOut) {
    if(!web3_provider) return 0;
    if(amountOut == 0) return 0;
    let amounts = await callSmartContract(
        contracts_provider.pancakeRouter,
        "getAmountsIn",
        [amountOut, [token1, token2]]
    );
    return amounts[0];
}

async function get_amount_out(reserve1, reserve2, amountIn) {
    if(!web3_provider) return 0;
    if(amountIn == 0) return 0;
    let amountOut = await callSmartContract(
        contracts_provider.pancakeRouter,
        "getAmountOut",
        [amountIn, reserve1, reserve2]
    );
    return amountOut;
}

function blockExplorer(type, hash) {
    return networks[active_network()].blockExplorer + '/' + type + '/' + hash;
}

function validateInput(amount, decimal = 18) {
    if(Number(amount) == NaN)
        return 0;
    if(Number(amount) < 0) return 0;
    amount = floor(amount, decimal);
    return amount;
}

function floor(number, decimal) {

    const num =  formatUnit(parseUnit(number, decimal), decimal, decimal);
    return num;
}


function ceil(number, decimal) {

    let num =  formatUnit(parseUnit(number, decimal), decimal, decimal);
    if(num < number)
        num += formatUnit("1", decimal, decimal);
    return num;
}

function goto404() {
    const path = location.pathname.split("/");
    path.pop();
    location.href = path.join("/") + '/404.html';
}

function goto(page) {
    const path = location.pathname.split("/");
    path.pop();
    location.href = path.join("/") + '/' + page;
}

async function runContract(contract, func, args, options = {}) {
    const {success, gas, message}  = await estimateGas(contract, func, args);
    if(!success) {
        notifier.warning(message);
        return;
    }
    let waiting_notifier;
    if(!notifier.no_waiting)
        waiting_notifier = notifier.info(
            options.confirmationTitle ? options.confirmationTitle : "Please wait",
            {durations: {info: 0}, labels: {info: "Waiting for confirmation"}, icons: {info: "spinner fa-spin"}})
    const promise = runSmartContract(contract, func, args)
        .on('transactionHash', (transactionHash) => {
            if(options.onPending) options.onPending();
            if(!options.no_pending) {
                if(waiting_notifier)
                    $(waiting_notifier).remove()
                notifier.async( promise, null, null, 
                    `${options.pendingTitle ? options.pendingTitle : "Transaction is in the queue"}
                    <br/>
                    Pending TxInfo: <a target='_blank' href='${blockExplorer('tx', transactionHash)}'>View</a>
                    `);
            }
        })
        .then(tx => {
            if(confNumber == 1){
                if(options.onDone) options.onDone();
            }
            if(waiting_notifier)
                $(waiting_notifier).remove();
        })
        .catch(err => {
            if(waiting_notifier)
                $(waiting_notifier).remove();
        })
    await promise;
}


async function get_token_balance(token_name) {
    let token_info = tokens[token_name.toUpperCase()];
    return await get_balance(new web3.eth.Contract(erc20ABI, token_info.address), token_info.decimals);

}

function myFixed(x, d) {
    if (!d) return x.toFixed(d); // don't go wrong if no decimal
    return x.toFixed(d).replace(/\.?0+$/, '');
}