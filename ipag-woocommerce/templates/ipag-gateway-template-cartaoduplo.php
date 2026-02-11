<?php
    require_once __DIR__.'/../classes/ipag-helper.php';
    use IpagGateway\IpagHelper;

    $ano = date('Y');

    $total = WC()->cart->total;
    $maxparcelas = $maximum_installment;
    $v_minimo = $smallest_installment;
    $juros = $interest_rate;
    $s_juros = $interest_free_installment;

    if (empty($total)) {
        $ped = new WC_Order(get_query_var('order-pay'));
        $total = $ped->get_total();
    }

    if ($total / $v_minimo < $maxparcelas) {
        $maxparcelas = (int) ($total / $v_minimo);
    }

    if ($maxparcelas >= 1) {
        for ($i = 1; $i <= $maxparcelas; $i++) {
            if ($i <= $s_juros) {
                $parcela[$i - 1] = $i.'x de R$'.number_format($total / $i, 2).' sem juros - R$'.number_format($total, 2);
            } else {
                $parcela[$i - 1] = $i.'x de R$'.number_format($parcelas_juros[$i - 1], 2).' com juros de '.$juros.'% a.m - R$'.number_format($parcelas_juros[$i - 1] * $i, 2);
            }
        }
    } else {
        $parcela[0] = '1x de R$'.number_format($total, 2).' sem juros - R$'.number_format($total, 2);
    }
    echo '<script src="'.plugins_url('js/masks.js', dirname(__FILE__)).'" ></script>';
    echo '<script src="'.plugins_url('js/cpf_cnpj.js', dirname(__FILE__)).'" ></script>';
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
    .box-fill{
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
<fieldset id="ipag-double-card-payment-form" class="ipag-payment-form">
    <div id="ipag-duplo1-payment-form">
        <div id="credit1_wrapper" class="card_wrapper nofloat">
            <div id="credit1_container" class="card_container card_container1">
                <div class="ipag-card-number anonymous">••••&nbsp; ••••&nbsp; ••••&nbsp; ••••</div>
                <div class="ipag-card-name">TITULAR DO CARTÃO</div>
                <div class="ipag-card-expiry"><span class="card-expiry-month">• •</span> / <span class="card-expiry-year">• •</span></div>
                <div class="ipag-card-brand"></div>
                <span class="ipag-card-cvv">•••</span>
            </div>
        </div>
        <ul>
        <?php foreach ($cardBrands as $card) {?>
            <li id="ipag_duplo1_brand_<?php echo $card; ?>" data-image-src="<?php echo plugins_url('../images/'.$card.'.png', __FILE__) ?>" />
        <?php }?>
        </ul>
        <input id="ipag_duplo1_card_type" type="hidden" name="ipag_duplo1_card_type" value=""/>
        <div id="card_valor_div" >
            <p class="form-row">
                <label for="ipag_duplo1_cc_valor"><?php _e('Valor', 'ipag-gateway');?>&nbsp;<abbr class="required" title="Digite o valor a ser cobrado no cartão">*</abbr></label>
                <input type="text" name="ipag_duplo1_cc_valor" id="ipag_duplo1_cc_valor" class="input-text" onchange="onValueChange('ipag_duplo1','ipag_duplo2',<?php echo $total; ?>,<?php echo $juros; ?>,<?php echo $maxparcelas; ?>,<?php echo $v_minimo; ?>,<?php echo $s_juros; ?>)" autocomplete="off" onkeyup="mask(this, maskMoney);" style="font-size: 1.5em; padding: 8px;" />
            </p>
        </div>
        <p class="form-row">
            <label for="ipag_duplo1_card_num"><?php _e('Número do Cartão', 'ipag-gateway');?>&nbsp;<abbr class="required" title="Digite o número do cartão">*</abbr></label>
            <input type="text" name="ipag_duplo1_card_num" id="ipag_duplo1_card_num" maxlength="19" class="input-text" data-ipag="number" autocomplete="off" onblur="sendToCard(this.value, 'ipag-card-number', 'credit1_container');" placeholder="&bull;&bull;&bull;&bull; &bull;&bull;&bull;&bull; &bull;&bull;&bull;&bull; &bull;&bull;&bull;&bull;" style="font-size: 1.5em; padding: 8px; width:85%;" />
            <span style="padding-right:3px; padding-top: 3px; display:inline-block;">
               <img id="ipag_duplo1_card_type_icon" src=""/>
            </span>
            <input id="ipag_duplo1_card_hash" type="hidden" name="ipag_duplo1_card_hash" value=""/>
            <input id="ipag_duplo1_card_token" type="hidden" name="ipag_duplo1_card_token" value=""/>
            <input id="ipag_duplo1_session" type="hidden" name="ipag_duplo1_session" value="<?php echo $ipag_session_id; ?>"/>
        </p>
        <p class="form-row">
            <label for="ipag_duplo1_card_name"><?php _e('Titular do Cartão', 'ipag-gateway');?>&nbsp;<abbr class="required" title="Digite exatamente o nome escrito na frente do cartão">*</abbr></label>
            <input type="text" name="ipag_duplo1_card_name" id = "ipag_duplo1_card_name" onblur="sendToCard(this.value, 'ipag-card-name', 'credit1_container');" class="input-text" autocomplete="off" style="font-size: 1.5em; padding: 8px;" />
        </p>
        <p class="form-row">
            <label for="ipag_duplo1_card_expiry"><?php _e('Validade do Cartão (Formato MM/AA)', 'ipag-gateway');?>&nbsp;<abbr class="required" title="Digite o Mês e os dois últimos dígitos do ano da validade do seu cartão">*</abbr></label>
              <input type="tel" name="ipag_duplo1_card_expiry" id="ipag_duplo1_card_expiry" class="input-text half-fill" placeholder="<?php _e('MM / AA', 'ipag-woocommerce');?>" onchange="sendToCard(this.value, 'ipag-card-expiry','credit1_container');" autocomplete="off"  style="font-size: 1.5em; padding: 8px;" />
        </p>
        <div class="clear"></div>
        <p class="form-row">
            <label for="ipag_duplo1_card_cvv"><?php _e('CVV', 'ipag-gateway');?> <abbr class="required" title="Digite o código de segurança do Cartão">*</abbr></label>
            <input id="ipag_duplo1_card_cvv" onkeyup="mask(this, maskNumber);" maxlength="4" name="ipag_duplo1_card_cvv" class="input-text wc-credit-card-form-card-cvc" type="tel" autocomplete="off" placeholder="••••" onfocus="toggleVerso('add','credit1_container');" onblur="checkCVV();toggleVerso('remove','credit1_container');" style="font-size: 1.5em; padding: 8px;" />
        </p>

        <?php if (!class_exists('WC_Subscriptions_Cart') || !WC_Subscriptions_Cart::cart_contains_subscription()): ?>
        <div class="clear"></div>
        <p class="form-row">
            <label for="ipag_duplo1_installments"><?php _e('Installments Number:', 'ipag-gateway');?> <abbr class="required" title="Selecione o número de parcelas">*</abbr></label>
                <select id="ipag_duplo1_installments" name="ipag_duplo1_installments" class="select_field box-fill" style="font-size: 1.5em; padding: 8px;" id="ipag_duplo1_cc_parcelas">
                    <?php foreach ($parcela as $key => $p) {?>
                        <option value="<?php echo $key ?>"><?php echo $p ?></option>
                    <?php }?>
                </select>
                <script type="text/javascript">
                    document.getElementById('ipag_duplo1_installments').value = '<?php echo IpagHelper::getParamFromPostData('ipag_duplo1_installments'); ?>';
                </script>
        </p>
        <?php endif;?>
    </div>

    <label>
        <h4>Segundo cartão</h4>
    </label>
    <div id="ipag-duplo2-payment-form">
        <div id="credit2_wrapper" class="card_wrapper nofloat">
            <div id="credit2_container" class="card_container card_container2">
                <div class="ipag-card-number anonymous">••••&nbsp; ••••&nbsp; ••••&nbsp; ••••</div>
                <div class="ipag-card-name">TITULAR DO CARTÃO</div>
                <div class="ipag-card-expiry"><span class="card-expiry-month">• •</span> / <span class="card-expiry-year">• •</span></div>
                <div class="ipag-card-brand"></div>
                <span class="ipag-card-cvv">•••</span>
            </div>
        </div>
        <ul>
        <?php foreach ($cardBrands as $card) {?>
            <li id="ipag_duplo2_brand_<?php echo $card; ?>" data-image-src="<?php echo plugins_url('../images/'.$card.'.png', __FILE__) ?>" />
        <?php }?>
        </ul>
        <input id="ipag_duplo2_card_type" type="hidden" name="ipag_duplo2_card_type" value=""/>
        <p class="form-row">
            <label for="ipag_duplo2_cc_valor"><?php _e('Valor', 'ipag-gateway');?>&nbsp;<abbr class="required" title="Digite o valor a ser cobrado no segundo cartão">*</abbr></label>
            <input type="text" name="ipag_duplo2_cc_valor" id="ipag_duplo2_cc_valor" onchange="onValueChange('ipag_duplo2','ipag_duplo1',<?php echo $total; ?>,<?php echo $juros; ?>,<?php echo $maxparcelas; ?>,<?php echo $v_minimo; ?>,<?php echo $s_juros; ?>)" class="input-text" autocomplete="off" onkeyup="mask(this, maskMoney);" style="font-size: 1.5em; padding: 8px;" />
        </p>

        <p class="form-row">
            <label for="ipag_duplo2_card_num"><?php _e('Número do Cartão', 'ipag-gateway');?>&nbsp;<abbr class="required" title="Digite o número do cartão">*</abbr></label>
            <input type="text" name="ipag_duplo2_card_num" id="ipag_duplo2_card_num" maxlength="19" class="input-text" data-ipag="number" autocomplete="off" onblur="sendToCard(this.value, 'ipag-card-number', 'credit2_container');" placeholder="&bull;&bull;&bull;&bull; &bull;&bull;&bull;&bull; &bull;&bull;&bull;&bull; &bull;&bull;&bull;&bull;" style="font-size: 1.5em; padding: 8px; width:85%;" />
            <span style="padding-right:3px; padding-top: 3px; display:inline-block;">
               <img id="ipag_duplo2_card_type_icon" src=""/>
            </span>
            <input id="ipag_duplo2_card_hash" type="hidden" name="ipag_duplo2_card_hash" value=""/>
            <input id="ipag_duplo2_card_token" type="hidden" name="ipag_duplo2_card_token" value=""/>
            <input id="ipag_duplo2_session" type="hidden" name="ipag_duplo2_session" value="<?php echo $ipag_session_id; ?>"/>
        </p>
        <p class="form-row">
            <label for="ipag_duplo2_card_name"><?php _e('Titular do Cartão', 'ipag-gateway');?>&nbsp;<abbr class="required" title="Digite exatamente o nome escrito na frente do cartão">*</abbr></label>
            <input type="text" name="ipag_duplo2_card_name" id = "ipag_duplo2_card_name" onblur="sendToCard(this.value, 'ipag-card-name', 'credit2_container');" class="input-text" autocomplete="off" style="font-size: 1.5em; padding: 8px;" />
        </p>
        <p class="form-row">
            <label for="ipag_duplo2_card_expiry"><?php _e('Validade do Cartão (Formato MM/AA)', 'ipag-gateway');?>&nbsp;<abbr class="required" title="Digite o Mês e os dois últimos dígitos do ano da validade do seu cartão">*</abbr></label>
              <input type="tel" name="ipag_duplo2_card_expiry" id="ipag_duplo2_card_expiry" class="input-text half-fill" placeholder="<?php _e('MM / AA', 'ipag-woocommerce');?>" onchange="sendToCard(this.value, 'ipag-card-expiry','credit2_container');" autocomplete="off"  style="font-size: 1.5em; padding: 8px;" />
        </p>
        <div class="clear"></div>
        <p class="form-row">
            <label for="ipag_duplo2_card_cvv"><?php _e('CVV', 'ipag-gateway');?> <abbr class="required" title="Digite o código de segurança do Cartão">*</abbr></label>
            <input id="ipag_duplo2_card_cvv" onkeyup="mask(this, maskNumber);" maxlength="4" name="ipag_duplo2_card_cvv" class="input-text wc-credit-card-form-card-cvc" type="tel" autocomplete="off" placeholder="••••" onfocus="toggleVerso('add','credit1_container');" onblur="checkCVV();toggleVerso('remove','credit2_container');" style="font-size: 1.5em; padding: 8px;" />
        </p>

        <?php if (!class_exists('WC_Subscriptions_Cart') || !WC_Subscriptions_Cart::cart_contains_subscription()): ?>
        <div class="clear"></div>
        <p class="form-row">
            <label for="ipag_duplo2_installments"><?php _e('Installments Number:', 'ipag-gateway');?> <abbr class="required" title="Selecione o número de parcelas">*</abbr></label>
                <select id="ipag_duplo2_installments" name="ipag_duplo2_installments" class="select_field box-fill" style="font-size: 1.5em; padding: 8px;" id="ipag_duplo2_cc_parcelas">
                    <?php foreach ($parcela as $key => $p) {?>
                        <option value="<?php echo $key ?>"><?php echo $p ?></option>
                    <?php }?>
                </select>
                <script type="text/javascript">
                    document.getElementById('ipag_duplo2_installments').value = '<?php echo IpagHelper::getParamFromPostData('ipag_duplo2_installments'); ?>';
                </script>
        </p>
        <?php endif;?>
     </div>
</fieldset>
<script>
    var ipag_submit = false;
    var ipag_test = <?php echo $ipag_test ?>;

    jQuery(document).ready(function(){
        jQuery('#ipag_duplo1_card_expiry').mask('00/00');
        jQuery('#ipag_duplo2_card_expiry').mask('00/00');
        var ipag_duplo1_card_num = document.querySelector('#ipag_duplo1_card_num');
        var ipag_duplo2_card_num = document.querySelector('#ipag_duplo2_card_num');
        var expiry1_date = document.querySelector('#ipag_duplo1_card_expiry');
        var expiry2_date = document.querySelector('#ipag_duplo2_card_expiry');
        expiry1_date.onblur = expiry2_date.onblur = function(e){
            if(this.value.length==5) {
                var splittedval = this.value.split('/');
                if(splittedval[0]<1 || splittedval[0]>12 ) {
                    this.value = '';
                }
            } else {
                this.value = '';
            }
        }

        jQuery('#ipag_duplo1_card_cvv').on('input blur keyup change click', function(){validaIpagCartao('duplo1',ipag_test); });
        jQuery('#ipag_duplo1_card_num').on('input blur keyup change click', function(){validaIpagCartao('duplo1',ipag_test); });
        jQuery('#ipag_duplo1_card_expiry').on('input blur keyup change click', function(){validaIpagCartao('duplo1',ipag_test); });
        jQuery('#ipag_duplo1_card_name').on('input blur keyup change click', function(){validaIpagCartao('duplo1',ipag_test); });
        jQuery('#ipag_duplo2_card_cvv').on('input blur keyup change click', function(){validaIpagCartao('duplo2',ipag_test); });
        jQuery('#ipag_duplo2_card_num').on('input blur keyup change click', function(){validaIpagCartao('duplo2',ipag_test); });
        jQuery('#ipag_duplo2_card_expiry').on('input blur keyup change click', function(){validaIpagCartao('duplo2',ipag_test); });
        jQuery('#ipag_duplo2_card_name').on('input blur keyup change click', function(){validaIpagCartao('duplo2',ipag_test); });

        ipag_duplo1_card_num.addEventListener("keyup", function() {
            var brand = iPag.getBrandInfo(this.value);
            if(brand && document.getElementById('ipag_duplo1_brand_'+brand.type)) {
                var imgpath = jQuery('#ipag_duplo1_brand_'+brand.type).attr('data-image-src');
                if(imgpath) {
                    jQuery( '#ipag_duplo1_card_type_icon' ).attr('src',imgpath);
                    jQuery( '#ipag_duplo1_card_type' ).val(brand.type);
                    var cvv = document.getElementById('ipag_duplo1_card_cvv');
                    if(brand.type == 'amex') {
                        cvv.maxLength = 4;
                        cvv.placeholder = "••••";
                    }
                    else {
                        cvv.maxLength = 3;
                        cvv.placeholder = "•••";
                    }
                }
            } else {
                jQuery( '#ipag_duplo1_card_type_icon' ).attr('src','');
                jQuery( '#ipag_duplo1_card_type' ).val('');
            }
        });

        ipag_duplo2_card_num.addEventListener("keyup", function() {
            var brand = iPag.getBrandInfo(this.value);
            if(brand && document.getElementById('ipag_duplo2_brand_'+brand.type)) {
                var imgpath = jQuery('#ipag_duplo2_brand_'+brand.type).attr('data-image-src');
                if(imgpath) {
                    jQuery( '#ipag_duplo2_card_type_icon' ).attr('src',imgpath);
                    jQuery( '#ipag_duplo2_card_type' ).val(brand.type);
                    var cvv = document.getElementById('ipag_duplo2_card_cvv');
                    if(brand.type == 'amex') {
                        cvv.maxLength = 4;
                        cvv.placeholder = "••••";
                    }
                    else {
                        cvv.maxLength = 3;
                        cvv.placeholder = "•••";
                    }
                }
            } else {
                jQuery( '#ipag_duplo2_card_type_icon' ).attr('src','');
                jQuery( '#ipag_duplo2_card_type' ).val('');
            }
        });

        jQuery( '#ipag_duplo1_cc_valor' ).val("<?php echo number_format($total/2, 2, ',', ''); ?>");
        onValueChange('ipag_duplo1','ipag_duplo2',<?php echo $total; ?>,<?php echo $juros; ?>,<?php echo $maxparcelas; ?>,<?php echo $v_minimo; ?>,<?php echo $s_juros; ?>);
    });

    jQuery( 'form.checkout' ).on( 'checkout_place_order_ipag-gateway-double-card', function(e) {
        return iPagFormValidator('duplo1', ipag_test, false);
    });

    jQuery( 'form#order_review' ).submit( function(e) {
        return iPagFormValidator('', ipag_test, false);
    });
</script>
