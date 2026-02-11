<?php
    $ano = date('Y');
    echo '<script src="'.plugins_url('js/masks.js', dirname(__FILE__)).'" ></script>';
    echo '<link href="'.plugins_url('css/ipag.css', dirname(__FILE__)).'" rel="stylesheet">';
    echo '<link href="'.plugins_url('css/custom-style.css', dirname(__FILE__)).'" rel="stylesheet">';
?>
    <style>
        @media screen and (max-width: 480px) {
            .half-fill{
                width: 100% !important;
            }
        }
        .noborder, .noborder td{
            border: 0px;
        }
        .fill{
            width: 100%;
        }
        .half-fill{
            width: 47.5%;
        }
        .select_field{
            padding: .6180469716em;
            background-color: #f2f2f2;
            color: #43454b;
            outline: 0;
            border: 0;
             -webkit-appearance: menulist;
            border-radius: 2px;
            box-sizing: border-box;
            font-weight: 400;
            box-shadow: inset 0 1px 1px rgba(0,0,0,.125);
        }
    </style>
    <fieldset id="ipag-debito-payment-form" class="ipag-payment-form">
        <div id="debit_wrapper" class="card_wrapper nofloat">
            <div id="debit_container" class="card_container">
                <div class="ipag-card-number anonymous">••••&nbsp; ••••&nbsp; ••••&nbsp; ••••</div>
                <div class="ipag-card-name">TITULAR DO CARTÃO</div>
                <div class="ipag-card-expiry"><span class="card-expiry-month">• •</span> / <span class="card-expiry-year">• •</span></div>
                <div class="ipag-card-brand"></div>
                <span class="ipag-card-cvv">•••</span>
            </div>
        </div>
        <ul>
        <?php foreach ($accepted_cards as $card) {?>
            <li id="ipag_debito_brand_<?php echo $card; ?>" data-image-src="<?php echo plugins_url('../images/'.$card.'.png', __FILE__) ?>" />
        <?php }?>
        </ul>
        <input id="ipag_debito_card_type" type="hidden" name="ipag_debito_card_type" value=""/>

        <p class="form-row">
            <label for="ipag_debito_card_num"><?php _e('Número do Cartão', 'ipag-gateway');?> <abbr class="required" title="Digite o número do cartão">*</abbr></label>
            <input id="ipag_debito_card_num" name="ipag_debito_card_num" class="input-text" type="tel" maxlength="19" data-ipag="number" autocomplete="off" onblur="sendToCard(this.value, 'ipag-card-number','debit_container');" placeholder="&bull;&bull;&bull;&bull; &bull;&bull;&bull;&bull; &bull;&bull;&bull;&bull; &bull;&bull;&bull;&bull;" style="font-size: 1.5em; padding: 8px; width:85%;"/>
            <span style="padding-right:3px; padding-top: 3px; display:inline-block;">
               <img id="ipag_debito_card_type_icon"></img>
            </span>
            <input id="ipag_debito_card_hash" type="hidden" name="ipag_debito_card_hash" value=""/>
            <input id="ipag_debito_card_token" type="hidden" name="ipag_debito_card_token" value=""/>
            <input id="ipag_debito_session" type="hidden" name="ipag_debito_session" value="<?php echo $ipag_session_id; ?>"/>
        </p>
        <p class="form-row">
            <label for="ipag_debito_card_name"><?php _e('Titular do Cartão', 'ipag-gateway');?> <abbr class="required" title="Digite exatamente o nome escrito na frente do cartão">*</abbr></label>
            <input id="ipag_debito_card_name" name="ipag_debito_card_name" onblur="sendToCard(this.value, 'ipag-card-name','debit_container');" class="input-text" type="text" autocomplete="off" style="font-size: 1.5em; padding: 8px;" />
        </p>
        <p class="form-row">
            <label for="ipag_debito_card_expiry"><?php _e('Validade do Cartão (Formato MM/AA)', 'ipag-gateway');?>&nbsp;<abbr class="required" title="Digite o Mês e os dois últimos dígitos do ano da validade do seu cartão">*</abbr></label>
              <input type="tel" name="ipag_debito_card_expiry" id="ipag_debito_card_expiry" class="input-text half-fill" placeholder="<?php _e('MM / AA', 'ipag-gateway');?>" onchange="sendToCard(this.value, 'ipag-card-expiry','debit_container');" autocomplete="off"  style="font-size: 1.5em; padding: 8px;" />
        </p>
        <div class="clear"></div>
        <p class="form-row">
            <label for="ipag_debito_card_cvv"><?php _e('CVV', 'ipag-gateway');?> <abbr class="required" title="Digite o código de segurança do Cartão">*</abbr></label>
            <input id="ipag_debito_card_cvv" name="ipag_debito_card_cvv" class="input-text wc-credit-card-form-card-cvc" type="tel" autocomplete="off" placeholder="•••" onfocus="toggleVerso('add','debit_container');" onblur="checkCVV();toggleVerso('remove','debit_container');" style="font-size: 1.5em; padding: 8px;" />
        </p>
    </fieldset>
    <script>
        jQuery(document).ready(function(){
            jQuery('#ipag_debito_card_expiry').mask('00/00');
            var ipag_debito_card_num = document.querySelector('#ipag_debito_card_num');
            var expiry_date = document.querySelector('#ipag_debito_card_expiry');
            expiry_date.onblur = function(e){
                if(this.value.length==5) {
                    var splittedval = this.value.split('/');
                    if(splittedval[0]<1 || splittedval[0]>12 ) {
                        this.value = '';
                    }
                } else {
                    this.value = '';
                }
            }

            jQuery('#ipag_debito_card_cvv').on('input blur keyup change click', function(){validaIpagCartao('debito',ipag_test); });
            jQuery('#ipag_debito_card_num').on('input blur keyup change click', function(){validaIpagCartao('debito',ipag_test); });
            jQuery('#ipag_debito_card_expiry').on('input blur keyup change click', function(){validaIpagCartao('debito',ipag_test); });
            jQuery('#ipag_debito_card_name').on('input blur keyup change click', function(){validaIpagCartao('debito',ipag_test); });

            ipag_debito_card_num.addEventListener("keyup", function() {
                var brand = iPag.getBrandInfo(this.value);
                var brandType = '';
                if(brand) {
                    brandType = brand.type;
                    if(brandType == 'visa') {
                        brandType = 'visaelectron';
                    }
                    if(brandType == 'mastercard') {
                        brandType = 'maestro';
                    }
                }
                if(brand && document.getElementById('ipag_debito_brand_'+brandType)) {
                    var imgpath = jQuery('#ipag_debito_brand_'+brandType).attr('data-image-src');
                    if(imgpath) {
                        jQuery( '#ipag_debito_card_type_icon' ).attr('src',imgpath);
                        jQuery( '#ipag_debito_card_type' ).val(brandType);
                        var cvv = document.getElementById('ipag_debito_card_cvv');
                            cvv.maxLength = 3;
                            cvv.placeholder = "•••";
                    }
                } else {
                    jQuery( '#ipag_debito_card_type_icon' ).attr('src','');
                    jQuery( '#ipag_debito_card_type' ).val('');
                }
            });
        });

        jQuery( 'form.checkout' ).on( 'checkout_place_order_ipag-gateway_debito', function(e) {
            return iPagFormValidator('debito', ipag_test, false);
        });

        jQuery( 'form#order_review' ).submit( function(e) {
            return iPagFormValidator('debito', ipag_test, false);
        });
    </script>
