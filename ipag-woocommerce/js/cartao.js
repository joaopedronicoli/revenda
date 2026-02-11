function _onCardChange(selectElement, numParcelasByCcType, code) {
	var selCard = selectElement.options[selectElement.selectedIndex].value;
	exibeParcelas(numParcelasByCcType[selCard], code);

	if ($(code + '_cc_number')) {
		if (selCard == 'diners'){
			$(code + '_cc_number').setAttribute('maxlength', 14);
		} else {
			$(code + '_cc_number').setAttribute('maxlength', 16);
		}
	}

	if ($(code + '_cc_cid')) {
		if (selCard == 'amex') {
			$(code + '_cc_cid').setAttribute('maxlength', 4);
		}
		else {
			$(code + '_cc_cid').setAttribute('maxlength', 3);
		}
	}

	//quando um tipo de cartao e escolhido, limpa a escolha dos outros campos de tipo de cartao
	var results = $$('select');
	results.each(function(elem){
		if (selectElement != elem && (elem.id.indexOf('cc_type') > 0 || elem.id.indexOf('cc_parcelas') > 0)) {
			elem.value = "";
		}
	});
}

function onCardChange(selCard, numParcelasByCcType, code) {
	//var selCard = selectElement.options[selectElement.selectedIndex].value;
	//alert(selCard);

    if(numParcelasByCcType) {
        exibeParcelas(numParcelasByCcType[selCard], code);
        $(code+'_cc_parcelas').value = "";
    }

    if ($(code + '_cc_number')) {
        $(code + '_cc_number').setAttribute('maxlength', 16);
        if (selCard == 'diners'){
            $(code + '_cc_number').setAttribute('maxlength', 14);
        }
        if (selCard == 'hipercard'){
            $(code + '_cc_number').setAttribute('maxlength', 19);
        }
    }

	if ($(code + '_cc_cid')) {
		if (selCard == 'amex') {
			$(code + '_cc_cid').setAttribute('maxlength', 4);
		}
		else {
			$(code + '_cc_cid').setAttribute('maxlength', 3);
		}
	}

    if($(code + '_aviso_visaelectron')) {
        if(selCard == 'visaelectron') {
            $(code + '_aviso_visaelectron').show();
        }
        else {
            $(code + '_aviso_visaelectron').hide();
        }
    }
}

function roundNumber(number,decimal_points) {
	if(!decimal_points) return Math.round(number);
	if(number == 0) {
		var decimals = "";
		for(var i=0;i<decimal_points;i++) decimals += "0";
		return "0,"+decimals;
	}
    if(number > 0 && number < 1) {
        var exp = Math.pow(10,decimal_points);
        var n = Math.round((number * exp)).toString();
        return "0," + n.slice(-1*decimal_points);
    }
	var exponent = Math.pow(10,decimal_points);
	var num = Math.round((number * exponent)).toString();
	return num.slice(0,-1*decimal_points) + "," + num.slice(-1*decimal_points);
}

function getCheckedRadioId(name) {
    var elements = document.getElementsByName(name);

    for (var i=0, len=elements.length; i<len; ++i)
        if (elements[i].checked) return elements[i].value;
    return null;
}

function onValueChange(changed, tochange, total, tax, maxp, minv, parsj) {
    var c1 = changed;
    var c2 = tochange;

    tochange = document.getElementById(tochange + '_cc_valor');
    changed = document.getElementById(changed + '_cc_valor');


    if(changed.value.indexOf(",") != -1 )
    {   changed.value = parseFloat(changed.value.replace(",","."));

    }
    if(parseInt(changed.value) > total) {
        changed.value = total;
        tochange.value = 0;

    }
    else {
        if(isNaN(parseFloat(changed.value)) || parseFloat(changed.value) < 0) {
            changed.value = '0';
        }
        tochange.value = total - changed.value;
    }
    c1 = document.getElementById(c1 + '_installments');
    c2 = document.getElementById(c2 + '_installments');
    
    c1.innerHTML = "";
    c2.innerHTML = "";
    getParcelas(c1, changed.value, tax, maxp, minv, parsj);
    getParcelas(c2, tochange.value, tax, maxp, minv, parsj);

    changed.value = changed.value<0.10? (Math.round(changed.value*100)/100).toFixed(2) : roundNumber(((Math.round(changed.value * 100) / 100)),2);
    tochange.value = tochange.value<0.10? (Math.round(tochange.value*100)/100).toFixed(2) :roundNumber(((Math.round(tochange.value * 100) / 100)),2);

}

function getCreditCardType(s) {
    var ccnumber = s.replace(/\D/g, "");
    var result = "";

    if(/^(401178|401179|431274|438935|451416|457393|457631|457632|504175|627780|636297|636368|(506699|5067[0-6]\d|50677[0-8])|(50900\d|5090[1-9]\d|509[1-9]\d{2})|65003[1-3]|(65003[5-9]|65004\d|65005[0-1])|(65040[5-9]|6504[1-3]\d)|(65048[5-9]|65049\d|6505[0-2]\d|65053[0-8])|(65054[1-9]|6505[5-8]\d|65059[0-8])|(65070\d|65071[0-8])|65072[0-7]|(65090[1-9]|65091\d|650920)|(65165[2-9]|6516[6-7]\d)|(65500\d|65501\d)|(65502[1-9]|6550[3-4]\d|65505[0-8]))[0-9]{10,12}$/.test(ccnumber)) {
        result = "elo";
    }
    else if(/^(((606282)\d{0,10})|((3841)\d{0,12}))$/.test(ccnumber)) {
        result = "hipercard";
    }
    else if(/^(637095|637612|637599|637609|637600|637568)[0-9]{10}$/.test(ccnumber)) {
        result = "hiper";
    }
    else if(/^[5|2][1-5][0-9]{14}$/.test(ccnumber)) {
        result = "mastercard";
    }
    else if(/^4[0-9]{12}([0-9]{3})?$/.test(ccnumber)) {
        result = "visa";
    }
    else if(/^3[47][0-9]{13}$/.test(ccnumber)) {
        result = "amex";
    }
    else if(/^3(0[0-5]|[68][0-9])[0-9]{11}$/.test(ccnumber)) {
        result = "diners";
    }
    else if(/^6011[0-9]{12}$/.test(ccnumber)) {
        result = "discover";
    }

    return result;
}

function getDebitCardType(s) {
    var ccnumber = s.replace(/\D/g, "");
    var result = "";

    if(/^5[1-5][0-9]{14}$/.test(ccnumber)) {
        result = "maestro";
    }
    else if(/^4[0-9]{12}([0-9]{3})?$/.test(ccnumber)) {
        result = "visaelectron";
    }

    return result;
}


function selectBandeira(ccnumber,code) {
    var bandeira = getCreditCardType(ccnumber);
    bandeira = code+bandeira;
    if(bandeira !== '' && $(bandeira)) {
        document.getElementById(bandeira).click();
    }
}

function selectBandeiraDebito(ccnumber,code) {
    var bandeira = getDebitCardType(ccnumber);
    bandeira = code+bandeira;
    if(bandeira !== '' && $(bandeira)) {
        document.getElementById(bandeira).click();
    }
}

//Card Validation usign Luhn algorithm
function validateCreditCardLibrepag(s) {
	var w = s.replace(/\D/g, ""); //remove all non-digit characters

	j = w.length / 2;
	k = Math.floor(j);
	m = Math.ceil(j) - k;
	c = 0;
	for (i=0; i<k; i++) {
		a = w.charAt(i*2+m) * 2;
		c += a > 9 ? Math.floor(a/10 + a%10) : a;
	}
	for (i=0; i<k+m; i++) c += w.charAt(i*2+1-m) * 1;
	return (c%10 == 0);
}

function validateSecurityCard(s,elem) {
	var w = s.replace(/\D/g, ""); //remove all non-digit characters
    var tamanho = elem.maxLength;
	if (tamanho != w.length){
		return false;
	} else {
		return true;
	}
}

function validaCartao(v) {
	return validateCreditCardLibrepag(v);
}

function atualizaParcelas(base) {
    var $j = jQuery.noConflict();
    $j("#parcelamento").hide();
    $j('#load-parc').show();
    $j.ajax({
            url: base+"librepag/librepag/parcelas",
            cache: false,
            async: true,
            isLoca: true
    })
    .done(function( html ) {
        $j("#parcelamento").html( html );
        $j('#load-parc').hide();
        $j("#parcelamento").show();
        $j('input[name="payment[cartao_type]"]:checked').trigger('click');
    });
}

function exibeParcelas(numParcelas, code) {
	var comboParcelas = document.getElementById(code + '_cc_parcelas');

	if (numParcelas == undefined) {
		numParcelas = comboParcelas.length - 1;
	}
	else {
		if(numParcelas <= (comboParcelas.length - 1)) {
            numParcelas = parseInt(numParcelas);
        }
        else {
            numParcelas = comboParcelas.length-1;
        }
	}

	//exibe o numero de parcelas solicitado. Atencao: o primeiro item do combo nao e parcela: � selecione o numero de parcelas
	for (var n=1; n <= numParcelas; n++) {
		comboParcelas.options[n].disabled = false;
	}
	//oculta o numero de parcelas restante
	for (var n=numParcelas+1; n < comboParcelas.length; n++) {
		comboParcelas.options[n].disabled = true;
	}
}

function getNumParcelas(total, maxp, minv) {
    var nparc = maxp;
    if(minv != '' && !isNaN(minv)) {
        var ppossiveis = Math.floor(total / minv);
        if(ppossiveis < nparc) {
            nparc = ppossiveis;
        }
    }
    if(nparc == '' || isNaN(nparc) || nparc <= 0) {
        nparc = 1;
    }
    return nparc;
}

function getValorParcela(value, parc, tax) {
    var parcsj = 1;
    if(isNaN(value) || value <= 0) {
        return(false);
    }
    if(parseInt(parc) != parc) {
        return(false);
    }
    if(isNaN(tax) || tax < 0) {
        return(false);
    }

    tax = tax / 100;
    var den = 0;
    if(parc > parcsj) {
        for(var i=1;i<=parc;i++) {
            den += 1/Math.pow(1+tax,i);
        }
    } else {
        den = parc;
    }

    return(value/den);
}

function getParcelas(element, total, tax, maxp, minv, parsj) {
    var parctax, parcvalue, text;
    tax = parseFloat(tax);
    parsj = parseInt(parsj);

    //element.options[element.options.length] = new Option('-- selecione o número de parcelas --','');
    for(var i=1; i <= getNumParcelas(total,maxp,minv); i++) {
        parctax = 0;
        if(i > parsj) {
            parctax = tax;
        }
        parcvalue = getValorParcela(total, i, parctax);
        //parcvalue = parcvalue.toFixed(2);
        //parcvalue = parcvalue.replace(/./gi,',');
        if(i < parsj+1 || tax == 0) {
            //1x de R$X.XX sem juros - R$X.XX
            text = i+"x de R$"+roundNumber(parcvalue,2)+" sem juros - R$"+roundNumber(parcvalue*i,2);
        } else {
            //10x de R$X.XX com juros de X.XX% a.m - R$X.XX
            text = i+"x de R$"+roundNumber(parcvalue,2)+" com juros de "+tax+"% a.m - R$"+roundNumber(parcvalue*i,2);
        }
        element.options[element.options.length] = new Option(text, i);
    }
}

function token_or_not() {
	var $j = jQuery.noConflict();
	var type = $$('input[name="payment\\[method\\]"]:checked').first().value;

	if( document.getElementById(type+'_token').value == 'new' ) {
		// Remove disable fields
		$j('.'+type+'_bandeiras :input').prop('disabled',false);
		$j('#'+type+'_cc_number').prop('disabled',false);
		$j('#'+type+'_cc_owner').prop('disabled',false);
		$j('#'+type+'_expiration').prop('disabled',false);
		$j('#'+type+'_expiration_yr').prop('disabled',false);
		$j('#'+type+'_cc_cid').prop('disabled',false);
		$j('#'+type+'_save_token').prop('disabled',false);


		// Show new credit card fields
		$j('#'+type+'_credit_card').show();
	} else {
		// Disable fields
		$j('.'+type+'_bandeiras :input').prop('disabled',true);
		$j('#'+type+'_cc_number').prop('disabled',true);
		$j('#'+type+'_cc_owner').prop('disabled',true);
		$j('#'+type+'_expiration').prop('disabled',true);
		$j('#'+type+'_expiration_yr').prop('disabled',true);
		$j('#'+type+'_cc_cid').prop('disabled',true);
		$j('#'+type+'_save_token').prop('disabled',true);

		// Hide new credit card fields
		$j('#'+type+'_credit_card').hide();
	}
}

function checkCvvSize(cvvId, cardtype)
{

    var bandeira = document.getElementById(cardtype).value;
    if(bandeira.includes('amex'))
    {
        document.getElementById(cvvId).maxLength = 4;
        document.getElementById(cvvId).placeholder = "••••";
    }
    else
    {
        document.getElementById(cvvId).maxLength = 3;
        document.getElementById(cvvId).placeholder = "•••";

    }
}

function iPagFormValidator(type, test_mode, is_pagseguro) {
    if ( window.ipag_submit && type != '' ) {
        window.ipag_submit = false;

        return true;
    }

    if(typeof type === "undefined") {
        var method = jQuery('input[name=payment_method]:checked', '#order_review').val();
        if(method == 'ipag-gateway') {
            type = 'credito';
        }
        else if(method == 'ipag-gateway_debito') {
            type = 'debito';
        }
        else if(method == 'ipag-gateway_boleto') {
            type = 'boleto';
        }
        else if(method == 'ipag-gateway_cartaoduplo') {
            type = 'duplo1';
        }
        else if(method == 'ipag-gateway_itaushopline') {
            type = 'itaushopline';
            return true;
        }
        else {
            return true;
        }
    }

    var form = jQuery( 'form.checkout, form#order_review' ),
        error           = false,
        isCard          = false,
        wrapper         = '',
        errorHtml       = '';

    if(type == 'credito' || type == 'debito' || type == 'duplo1' || type == 'duplo2') {
        var brand           = jQuery( '#ipag_'+type+'_card_type', form ).val(),
            name            = jQuery( '#ipag_'+type+'_card_name', form ).val(),
            cpf             = jQuery( '#ipag_'+type+'_card_cpf', form ).val(),
            cardNumber      = jQuery( '#ipag_'+type+'_card_num', form ).val().replace( /[^\d]/g, '' ),
            cvv             = jQuery( '#ipag_'+type+'_card_cvv', form ).val(),
            expirationMonth = jQuery( '#ipag_'+type+'_card_expiry', form ).val().replace( /[^\d]/g, '' ).substr( 0, 2 ),
            expirationYear  = '20' + jQuery( '#ipag_'+type+'_card_expiry', form ).val().replace( /[^\d]/g, '' ).substr( 2 ),
            installments    = jQuery( '#ipag_'+type+'_installments', form );
        isCard = true;
    }

    today           = new Date();

    errorHtml += '<ul style="margin: 0 !important;">';

    wrapper = jQuery( '#ipag-'+type+'-payment-form' );

    if(isCard) {
        if ( typeof brand === 'undefined' || '' === brand ) {
            errorHtml += '<li>' + errors['invalid_card'] + '</li>';
            error = true;
        }

        if ( name.trim().indexOf(' ') == -1 || name.trim().length < 1  ) {
            errorHtml += '<li>' + errors['invalid_name'] + '</li>';
            error = true;
        }

        if ( cpf !== undefined ) {
            cpf = cpf.replace( /[^\d]/g, '' );
            if (!isCpf(cpf)) {
                errorHtml += '<li>' + errors['invalid_cpf'] + '</li>';
                error = true;
            }
        }

        if( !validateCreditCardLibrepag(cardNumber) || cardNumber.length < 13 ) {
            errorHtml += '<li>' + errors['invalid_card'] + '</li>';
            error = true;
        }

        if ( 2 !== expirationMonth.length || 4 !== expirationYear.length ) {
            errorHtml += '<li>' + errors['invalid_expiry'] + '</li>';
            error = true;
        }

        if ( ( 2 === expirationMonth.length && 4 === expirationYear.length ) && ( expirationMonth > 12 || expirationYear <= ( today.getFullYear() - 1 ) || expirationYear >= ( today.getFullYear() + 20 ) || ( expirationMonth < ( today.getMonth() + 2 ) && expirationYear.toString() === today.getFullYear().toString() ) ) ) {
            errorHtml += '<li>' + errors['expired_card'] + '</li>';
            error = true;
        }

        if ( ( cvv.length != jQuery( '#ipag_'+type+'_card_cvv', form ).attr('maxlength') ) ) {
            errorHtml += '<li>' + errors['invalid_cvv'] + '</li>';
            error = true;
        }

        if ( installments !== undefined ) {
            if ( '' == installments.val() ) {
                errorHtml += '<li>' + errors['invalid_installment'] + '</li>';
                error = true;
            }
        }
    } else if (is_pagseguro == true) {
        var hash = jQuery( '#boleto_hashpagseguro', form ).val();

        if (hash == undefined || '' === hash) {
            errorHtml += '<li>Erro ao gerar boleto, por favor tente recarregar a página</li>';
            error = true;
        }
    }

    errorHtml += '</ul>';

    if ( ! error ) {
        jQuery( '.woocommerce-error', wrapper ).remove();
        if (type == 'duplo1') {
            response = iPagFormValidator('duplo2', test_mode, false);
            if(!response) {
                return false;
            }
        }
        //corrigir loop
        window.ipag_submit = true;
        //form.submit();
        return true;
    // Display the error messages.
    } else {
        iPagError( errorHtml, wrapper );
    }

    return false;
}

function iPagError( error, wrapper ) {
    jQuery( '.woocommerce-error', wrapper ).remove();
    wrapper.prepend( '<div class="woocommerce-error" style="margin-bottom: 0.5em !important;">' + error + '</div>' );
}

function getIpagToken(type,number, month, year, holder, cvv, idToken, form, test) {
    iPag.setIpagId(jQuery('#ipag_'+type+'_session').val());
    if(test) {
        iPag.setTestMode();
    }
    if(type == 'debito') {
        iPag.setDebit();
    }
    iPag.setCreditCard(
        holder,
        number,
        month,
        year,
        cvv
    );
    iPag.createToken()
    .then(function(response) {
        if(response.token) {
            idToken.val(response.token);
        }
        else {
            console.log(response);
            console.log("Erro salvando cartão: " + JSON.stringify(response))
        }
    })
    .catch(function(error){
        console.log(error);
        console.log("Erro salvando cartão: " + JSON.stringify(error));
    });
    return false;
}

function checkLength(obj, size) {
    return (obj && obj.length > size);
}

validaIpagCartao = function(type, test_mode) {
    var cid = jQuery('#ipag_'+type+'_card_cvv').val();
    var number = jQuery('#ipag_'+type+'_card_num').val().trim();
    var holder = jQuery('#ipag_'+type+'_card_name').val();
    var expiry_date = jQuery('#ipag_'+type+'_card_expiry').val();
    var month = expiry_date.split("/")[0];
    var year = expiry_date.split("/")[1];
    var data = new Date();
    var ano = ""+data.getFullYear();
    year = ano.substring(0,2) + year;
    var idToken = jQuery('#ipag_'+type+'_card_token');
    var form = jQuery( 'form.checkout, form#order_review' );
    var cardHash = jQuery('#ipag_'+type+'_card_hash');

    if(checkLength(cid,2) && checkLength(number,12) && validateCreditCardLibrepag(number) && checkLength(month,0) && checkLength(year,0) && checkLength(cid,2)){
        var data = number+cid+month+year+holder;
        var temporaryHash = CryptoJS.MD5(data).toString();
        if(temporaryHash !== cardHash.val()) {
            cardHash.val(temporaryHash);
            getIpagToken(type,number,month,year,holder,cid,idToken,form,test_mode);
            if(type === 'credito' && typeof validaPagSeguroCartao === 'function') {
                validaPagSeguroCartao();
            }
        }
    }
}

function toggleVerso(action, container) {
    "use strict";
    if (action === 'add') {
        jQuery('#'+container).addClass('verso');
    }else{
        jQuery('#'+container).removeClass('verso');
    }
}

function checkCVV(bandeira) {
    "use strict";
    var cvvField = jQuery("#ipag_credito_card_cvv");
    if (bandeira && bandeira != 'undefined') {
        var brand = bandeira.toLowerCase();
    }else{
        var brand = jQuery('#ipag_credito_card_type').val().toLowerCase();
    }
    if (cvvField.val()) {
        if (brand == 'amex' && cvvField.val().length != 4 || brand != 'amex' && cvvField.val().length != 3) {
            cvvField.parent().parent().addClass('form-error');
            console.log('CVV inválido. '+ brand +' com '+ cvvField.val().length +' caracteres.');
            return false;
        }else{
            cvvField.parent().parent().removeClass('form-error').addClass('form-ok');
            return true;
        }
    }
}

function sendToCard(str, classe, container) {
    "use strict";
    if(classe === 'card-expiry-month' && str.length == 1) {
        str = '0'+str;
    }
    if (str.length > 1) {
        jQuery('#'+container+' .' + classe).html(str);
        if(classe === 'card-number') {
            var txt = jQuery('#number_card').html();
            jQuery('#number_card').html(txt);
        }
    }
}