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

    $cartTotal = $total;

    if (!empty($pass_installments)) {
        foreach ($pass_installments as $inst) {
            $instParcela = (int) IpagHelper::getArrayItem('installment', $inst);
            $totalAmount = (float) IpagHelper::getArrayItem('amount', $inst);
            $instAmount = (float) IpagHelper::getArrayItem('installmentAmount', $inst);
            $instFree = (bool) IpagHelper::getArrayItem('interest', $inst);

            // $instFeePercent = (float) IpagHelper::getArrayItem('feePercent', $inst);

            $parcela[$instParcela] = "{$instParcela}x de R$ " . number_format($instAmount, 2, ',', '.');
            $parcela[$instParcela] .= ' - ' . (empty($instFree) ? 'sem juros' : 'com juros');
            $parcela[$instParcela] .= !empty($instFeePercent) ? ' de ' . number_format($instFeePercent, 2, ',', '.') . '%' : '';
            $parcela[$instParcela] .= !empty($instFree) ? " - R$ " . number_format($totalAmount, 2, ',', '.') : '';
        }
    } else {
        if (!empty($total) && !empty($v_minimo) && $total / $v_minimo < $maxparcelas) {
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
    }

    echo '<script src="'.plugins_url('js/masks.js', dirname(__FILE__)).'" ></script>';
    echo '<script src="'.plugins_url('js/cpf_cnpj.js', dirname(__FILE__)).'" ></script>';
    echo '<link href="'.plugins_url('css/ipag.css?v=1.0.1', dirname(__FILE__)).'" rel="stylesheet">';
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


    <?php if ($pagseguro_enabled !== 'no'): ?>
    <script>
    var $j = jQuery.noConflict();

    function getSenderHashCard() {
        PagSeguroDirectPayment.onSenderHashReady(function(response){
            jQuery( '#cartao_hashpagseguro' ).val(response.senderHash);
        });
    }
    callPagSeguroCard = function() {
      var session = "<?php echo $pagseguro_session ?>";

      var cid = $j('#ipag_credito_card_cvv').val();
      var number = $j('#ipag_credito_card_num').val();
      number = number.replace(/\D/g ,"");
      var expiry_date = $j('#ipag_credito_card_expiry').val();
      var month = expiry_date.split("/")[0];
      var year = expiry_date.split("/")[1];
      var data = new Date();
      var ano = ""+data.getFullYear();
      year = ano.substring(0,2) + year;
      var type = $j('#ipag_credito_card_type').val();
      var idToken = $j('#cartao_tokenpagseguro');

      tokenPagseguroCartaoiPag(session,number,month,year,type,cid,idToken);
    }

    checkLength = function (obj, size) {
      return (obj && obj.length > size);
    }

    validaPagSeguroCartao = function() {
      var cid = $j('#ipag_credito_card_cvv').val();
      var number = $j('#ipag_credito_card_num').val();
      var expiry_date = $j('#ipag_credito_card_expiry').val();
      var month = expiry_date.split("/")[0];
      var year = expiry_date.split("/")[1];
      var data = new Date();
      var ano = ""+data.getFullYear();
      year = ano.substring(0,2) + year;
      var type = $j('#ipag_credito_card_type').val();
      if(checkLength(cid,2) && checkLength(number.trim(),10) && checkLength(month,0) && checkLength(year,0) && checkLength(cid,2)){
        callPagSeguroCard();
      }
    }

    function tokenPagseguroCartaoiPag(session, number, month, year, type, cvv, idToken) {
        PagSeguroDirectPayment.setSessionId(session);

        PagSeguroDirectPayment.createCardToken({
            cardNumber: number,
            brand: type,
            cvv: cvv,
            expirationMonth: month,
            expirationYear: year,
            success: function(callback) {

            },
             error: function(callback) {
                reload = false;
                if(undefined != callback.errors["30400"]) {
                    error = 'Dados do cartão inválidos.';
                } else if (undefined != callback.errors["10001"]) {
                    error = 'Tamanho do cartão inválido.';
                } else if (undefined != callback.errors["10006"]) {
                    error = 'Tamanho do CVV inválido.';
                } else if (undefined != callback.errors["30405"]) {
                    error = 'Data de validade incorreta.';
                } else if (undefined != callback.errors["30403"]) {
                    error = 'Sessão inválida, a página será atualizada.';
                    reload = true;
                } else if (undefined != callback.errors["30404"]) {
                    error = 'Sessão inválida, a página será atualizada.';
                    reload = true;
                } else {
                    error = 'Verifique os dados do cartão digitado.';
                }
                console.error('Falha ao obter o token do cartao.');
                console.warn(error);
                console.log(callback.errors);
                if(reload) {
                    location.reload();
                }
            },
            complete: function(callback) {
                console.log(callback);
                idToken.val(callback.card.token);
                 getSenderHashCard();

            },
        });
    }
    </script>
    <?php
        endif;
    ?>

    <style>
        .wc-ipag-card-option {
            display: none;
        }

        .input-search-ipag ~ .select2-container .select2-selection--single {
            height: 55px;
            border-radius: 0;
            border-color: rgba(0,0,0,.125);
        }

        .input-search-ipag ~ .select2-container--default .select2-selection--single .select2-selection__rendered {
            font-weight: 500;
            font-size: 1.25em;
            line-height: 55px;
        }

        .input-search-ipag ~ .select2-container--default .select2-selection--single .select2-selection__arrow {
            height: 55px;
        }

        .wc-ipag-select2 {
            background-repeat: no-repeat;
            background-size: 35px auto;
            background-position: right 15px center;
        }

        .wc-ipag-card-option-label {
            color: #343a40;
            display: block;
            cursor: pointer;
            font-weight: 600;
            user-select: none;
            margin-bottom: 1em;
            padding: 0 !important;
            margin: 0 0 .75rem !important;
            margin-left: .75rem !important;
        }

        .wc-ipag-card-option-label::before {
            content: "";
            background: #fff;
            border-radius: 100%;
            border: 2px solid #fff;
            box-shadow: 0 0 0 2px #000;
            transform: translateY(2px);
            display: inline-block;
            margin-right: .5em;
            margin-left: 4px;
            height: 11px;
            width: 11px;
        }

        .wc-ipag-card-option:checked + .wc-ipag-card-option-label {
            color: green;
        }

        .wc-ipag-card-option:checked + .wc-ipag-card-option-label::before {
            background: green;
            box-shadow: 0 0 0 2px green;
        }

        .wc-ipag-card-option-label + fieldset {
            margin-top: 1.15rem !important;
        }
    </style>

    <?php

    if (!empty($allow_saved_cards)) {
        if (!empty($saved_cards)) {
            ?>
                <input type="radio" checked class="wc-ipag-card-option" id="ipag_saved_card_option_cards" name="ipag_saved_card_option" value="saved">
                <label for="ipag_saved_card_option_cards" class="wc-ipag-card-option-label">
                    <?= _e('Cartões Salvos', 'ipag-gateway') ?>
                </label>

                <Fieldset data-form-ipag class="saved-cards-form-ipag" style="max-width: 300px; margin: 1.15rem auto 1.15rem; padding: 0;">

                    <p class="form-row" style="margin: 0;">
                        <label for="saved-cards-ipag"><?php _e('Meus cartões:', 'ipag-gateway');?> <abbr class="required" title="Selecione o cartão">*</abbr></label>
                        <select class="input-search-ipag" id="saved-cards-ipag" name="saved_cards_ipag" style="width: 100%;">
                            <?php
                            foreach ($saved_cards as $card) {
                                ?>
                                    <option data-brand="<?= $card->get_card_type() ?>" data-expiry="Expira: <?= sprintf('%s/%s', $card->get_expiry_month(), substr($card->get_expiry_year(), -2)) ?>" value="<?= $card->get_id() ?>">•••• •••• •••• <strong><?= $card->get_last4() ?></strong> (<?= ucfirst($card->get_card_type()) ?>)</option>
                                <?php
                            }
                            ?>
                        </select>
                    </p>

                    <p class="form-row installments-form-ipag" style="margin: 1.15rem 0 0;">
                        <label for="ipag_saved_cards_installments"><?php _e('Installments Number:', 'ipag-gateway');?> <abbr class="required" title="Selecione o número de parcelas">*</abbr></label>
                        <select required id="ipag_saved_cards_installments" name="ipag_saved_cards_installments" class="select_field select2-ipag box-fill" style="font-size: 1.25em; font-weight: 500; padding: 8px; background: white; border: 1px solid rgba(0,0,0,.125); box-shadow: none; height: 55px;" >
                            <?php foreach ($parcela as $key => $p) {?>
                                <option value="<?php echo $key ?>"><?php echo $p ?></option>
                            <?php }?>
                        </select>
                    </p>

                </Fieldset>
            <?php
        }
        ?>
        <input type="radio" <?= empty($saved_cards) ? 'checked' : '' ?> class="wc-ipag-card-option" id="ipag_saved_card_option_new" name="ipag_saved_card_option" value="new">
        <label for="ipag_saved_card_option_new" class="wc-ipag-card-option-label" style="margin-bottom: 0 !important;">
            <?= _e('Novo Cartão', 'ipag-gateway') ?>
        </label>
        <?php
    }
    ?>

    <fieldset data-form-ipag id="ipag-credito-payment-form" class="ipag-payment-form" style="max-width: 300px; margin: 1rem auto 0; padding: 0; <?= !empty($saved_cards) ? 'display: none;' : '' ?>">
        <input type="hidden" id = "cartao_tokenpagseguro" name="cartao_tokenpagseguro" value="" />
        <input type="hidden" id = "cartao_hashpagseguro" name = "cartao_hashpagseguro"  value=""/>
        <input type="hidden" class="ipag_helper_cart_total" value="<?= $cartTotal ?>" />

        <?php
            foreach (array_values(WC()->cart->get_cart()) as $cart_item_key => $cart_item) {
                $product = $cart_item['data'];
                $quantity = $cart_item['quantity'];
                $product_name = $product->get_name();
                $product_price = $product->get_price();
                $description = $product->get_description();

                echo '<input type="hidden" name="ipag_helper_product['.  $cart_item_key .'][name]" value="' . esc_attr( $product_name ) . '"/>';
                echo '<input type="hidden" name="ipag_helper_product['.  $cart_item_key .'][price_cents]" value="' . number_format(esc_attr( $product_price ), 2, '', '') . '"/>';
                echo '<input type="hidden" name="ipag_helper_product['.  $cart_item_key .'][quantity]" value="' . esc_attr( $quantity ) . '"/>';
                echo '<input type="hidden" name="ipag_helper_product['.  $cart_item_key .'][id]" value="' . esc_attr( $product->get_id() ) . '"/>';
                echo '<input type="hidden" name="ipag_helper_product['.  $cart_item_key .'][sku]" value="' . esc_attr( $product->get_sku() ) . '"/>';
                echo '<input type="hidden" name="ipag_helper_product['.  $cart_item_key .'][description]" value="' . substr( esc_attr( wp_strip_all_tags( $description ) ), 0, 100 ) . '"/>';
            }
        ?>

        <?php
        if (empty($disable_card_fill_preview) || 'no' === $disable_card_fill_preview) {
            ?>
            <div style="margin-bottom: .5em" id="card_wrapper" class="card_wrapper nofloat">
                <div id="card_container" class="card_container">
                    <div class="ipag-card-number anonymous">••••&nbsp; ••••&nbsp; ••••&nbsp; ••••</div>
                    <div class="ipag-card-name">TITULAR DO CARTÃO</div>
                    <div class="ipag-card-expiry"><span class="card-expiry-month">• •</span> / <span class="card-expiry-year">• •</span></div>
                    <div class="ipag-card-brand"></div>
                    <span class="ipag-card-cvv">•••</span>
                </div>
            </div>
        <?php
            }
            ?>

        <ul style="margin-bottom: 0">
        <?php foreach ($cardBrands as $card) {?>
            <li id="ipag_credito_brand_<?php echo $card; ?>" data-image-src="<?php echo plugins_url('../images/'.$card.'.png', __FILE__) ?>" ></li>
        <?php }?>
        </ul>
        <input id="ipag_credito_card_type" type="hidden" name="ipag_credito_card_type" value=""/>

        <div>
            <div class="container-brands-accepted">
                <?php foreach ($accepted_cards as $card) {?>
                    <span class="wrapper-brand">
                        <img data-accepted-brand-<?= $card ?> class="img-responsive img-fluid" src="<?php echo plugins_url('../images/'.$card.'.png', __FILE__) ?>" />
                    </span>
                <?php }?>
            </div>

            <p style="position: relative" class="form-row">
                <label for="ipag_credito_card_num"><?php _e('Número do Cartão', 'ipag-gateway');?>&nbsp;<abbr class="required" title="Digite o número do cartão">*</abbr></label>
                <input type="text" name="ipag_credito_card_num" id="ipag_credito_card_num" maxlength="19" class="input-text input-ipag" data-ipag="number" autocomplete="off" onblur="sendToCard(this.value, 'ipag-card-number', 'card_container');" placeholder="&bull;&bull;&bull;&bull; &bull;&bull;&bull;&bull; &bull;&bull;&bull;&bull; &bull;&bull;&bull;&bull;" style="font-size: 1.5em; padding: 8px; width:100%;" />
                <span style="display:inline-block;position: absolute;top: calc(50% + .75em);right: 8px;transform: translateY(-50%);z-index: 99;">
                    <img id="ipag_credito_card_type_icon"></img>
                </span>
                <input id="ipag_credito_card_hash" type="hidden" name="ipag_credito_card_hash" value=""/>
                <input id="ipag_credito_card_token" type="hidden" name="ipag_credito_card_token" value=""/>
                <input id="ipag_credito_session" type="hidden" name="ipag_credito_session" value="<?php echo $ipag_session_id; ?>"/>
            </p>
            <p class="form-row">
                <label for="ipag_credito_card_name"><?php _e('Titular do Cartão', 'ipag-gateway');?>&nbsp;<abbr class="required" title="Digite exatamente o nome escrito na frente do cartão">*</abbr></label>
                <input type="text" name="ipag_credito_card_name" id = "ipag_credito_card_name" onblur="sendToCard(this.value, 'ipag-card-name', 'card_container');" class="input-text input-ipag" autocomplete="off" style="font-size: 1.5em; padding: 8px;" />
            </p>
            <p class="form-row">
                <label for="ipag_credito_card_expiry"><?php _e('Validade do Cartão (Formato MM/AA)', 'ipag-gateway');?>&nbsp;<abbr class="required" title="Digite o Mês e os dois últimos dígitos do ano da validade do seu cartão">*</abbr></label>
                <input type="tel" name="ipag_credito_card_expiry" id="ipag_credito_card_expiry" class="input-text input-ipag half-fill" placeholder="<?php _e('MM / AA', 'ipag-woocommerce');?>" onchange="sendToCard(this.value, 'ipag-card-expiry', 'card_container');" autocomplete="off"  style="font-size: 1.5em; padding: 8px;" />
            </p>

            <div class="clear"></div>
            <p class="form-row">
                <label for="ipag_credito_card_cvv"><?php _e('CVV', 'ipag-gateway');?> <abbr class="required" title="Digite o código de segurança do Cartão">*</abbr></label>
                <input id="ipag_credito_card_cvv" onkeyup="mask(this, maskNumber);" maxlength="4" name="ipag_credito_card_cvv" class="input-text input-ipag wc-credit-card-form-card-cvc" type="tel" autocomplete="off" placeholder="••••" onfocus="toggleVerso('add','card_container');" onblur="checkCVV();toggleVerso('remove','card_container');" style="font-size: 1.5em; padding: 8px;" />
            </p>

            <?php if (!class_exists('WC_Subscriptions_Cart') || !WC_Subscriptions_Cart::cart_contains_subscription()): ?>
            <div class="clear"></div>
            <p class="form-row">
                <label for="ipag_credito_installments"><?php _e('Installments Number:', 'ipag-gateway');?> <abbr class="required" title="Selecione o número de parcelas">*</abbr></label>
                    <select required id="ipag_credito_installments" name="ipag_credito_installments" class="select_field select-ipag box-fill" style="font-size: 1.5em; padding: 8px;" >
                        <option selected value="0">Selecione</option>
                        <?php foreach ($parcela as $key => $p) {?>
                            <option value="<?php echo $key ?>"><?php echo $p ?></option>
                        <?php }?>
                    </select>
                    <script type="text/javascript">
                        document.getElementById('ipag_credito_installments').value = <?php echo IpagHelper::getParamFromPostData('ipag_credito_installments'); ?>;
                    </script>
            </p>

            <?php endif;?>

            <?php if (empty($disable_card_cpf) || (!empty($disable_card_cpf) && $disable_card_cpf === 'no')) { ?>
                <p class="form-row">
                    <label for="ipag_credito_card_cpf"><?php _e('CPF do portador do cartão', 'ipag-gateway');?> <abbr class="required" title="Digite o CPF do portador do Cartão">*</abbr></label>
                    <input type="text" name="ipag_credito_card_cpf" id="ipag_credito_card_cpf" maxlength="14" class="box-fill input-ipag" onkeyup="mask(this, maskCpf);" style="font-size: 1.5em; padding: 8px;" />
                </p>
            <?php } ?>

            <?php
            if (!empty($allow_saved_cards)) {
                ?>
                    <label class="checkbox" style="cursor: pointer;">
                        <input type="checkbox" class="ipag-check-save-card check-ipag" name="ipag_check_save_card" style="width: 1rem;height: 1rem;vertical-align: sub; margin-right: 2px" value="1">
                        <span class="ipag-check-save-card-span" style="line-height: .5rem;">Salvar informações para compras futuras.</span>
                    </label>
                <?php
            }
            ?>

        </div>

    </fieldset>

    <script>
        var img_dir = '<?= plugins_url('../images/', __FILE__) ?>';

        function buildTemplateResult(state) {
            var brand = state?.element?.getAttribute('data-brand');
            var expiry = state?.element?.getAttribute('data-expiry');
            var img_source = `${img_dir}${brand}.png`;

            var $state = jQuery(
                `
                <div style="display: flex; align-items: center; padding: .5rem 0 .475rem">
                    <div style="margin-right: .25rem">
                        ${!!brand && `<img style="display: inline-block; max-height: 20px; vertical-align: middle; margin-right: 2px" src="${img_source}" class="img-flag" />`}
                    </div>
                    <div style="display: flex; flex-direction: column">
                        <span style="display: block; line-height: .75;">
                            ${state.text}
                        </span>
                        <small style="font-size: .625rem; line-height: 1.5; font-weight: 600;">
                            ${expiry}
                        </small>
                    </div>
                </div>`
            );

            return $state;
        }

        function buildTemplateSelection(data, container) {
            var brand = data?.element?.getAttribute('data-brand');
            var img_source = `${img_dir}${brand}.png`;

            jQuery(container).addClass('wc-ipag-select2');
            jQuery(container).css('background-image', `url(${img_source})`);

            return data.text;
        }

        jQuery(document).ready(function(){
            jQuery('.input-search-ipag').select2({
                templateResult: buildTemplateResult,
                templateSelection: buildTemplateSelection,
                escapeMarkup : function(markup) {
                    return markup;
                }
            });

            jQuery('.wc-ipag-card-option').on('change', function() {
                jQuery('[data-form-ipag] .input-ipag').val('');
                jQuery('[data-form-ipag] .select-ipag').val('0');
                jQuery('[data-form-ipag] .select2-ipag').val('1');
                jQuery('[data-form-ipag] .check-ipag').prop('checked', false);

                if (this.value === 'new') {
                    jQuery('.ipag-payment-form').slideDown(300);
                    jQuery('.saved-cards-form-ipag').slideUp(300);
                }
                else {
                    jQuery('.ipag-payment-form').slideUp(300);
                    jQuery('.saved-cards-form-ipag').slideDown(300);
                }
            });
        });

        window.ipagEffectEnableBrandSelected = function(el, elParent) {
            el.setAttribute('data-selected', '');
            elParent.setAttribute('data-brand-selected', '');
        }

        window.ipagEffectDisableBrandSelected = function(el) {
            el.removeAttribute('data-brand-selected');

            elbrandSelected = el.querySelector('[data-selected]');

            if (elbrandSelected)
                elbrandSelected.removeAttribute('data-selected');
        }

        window.ipagEffectBrandSelected = function(brand) {
            var containerBrands = document.querySelector('.container-brands-accepted');

            if (!containerBrands)
                return;

            window.ipagEffectDisableBrandSelected(containerBrands);

            if (brand && 'type' in brand) {
                elBrand = document.querySelector('[data-accepted-brand-'+ brand.type +']');

                if (elBrand) {
                    window.ipagEffectEnableBrandSelected(elBrand, containerBrands);
                    return;
                }

            }
        }
    </script>

    <script>
        var ipag_submit = false;
        var ipag_test = <?php echo $ipag_test ?>;

        jQuery(document).ready(function(){
            iPag.setup();
            jQuery('#ipag_credito_card_expiry').mask('00/00');
            var ipag_credito_card_num = document.querySelector('#ipag_credito_card_num');
            var expiry_date = document.querySelector('#ipag_credito_card_expiry');
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

            jQuery('#ipag_credito_card_cvv').on('input blur keyup change click', function(){validaIpagCartao('credito',ipag_test); });
            jQuery('#ipag_credito_card_num').on('input blur keyup change click', function(){validaIpagCartao('credito',ipag_test); });
            jQuery('#ipag_credito_card_expiry').on('input blur keyup change click', function(){validaIpagCartao('credito',ipag_test); });
            jQuery('#ipag_credito_card_name').on('input blur keyup change click', function(){validaIpagCartao('credito',ipag_test); });

            ipag_credito_card_num.addEventListener("keyup", function() {
                var brand = iPag.getBrandInfo(this.value);

                window.ipagEffectBrandSelected && window.ipagEffectBrandSelected(brand);

                if(brand && document.getElementById('ipag_credito_brand_'+brand.type)) {
                    var imgpath = jQuery('#ipag_credito_brand_'+brand.type).attr('data-image-src');
                    if(imgpath) {
                        jQuery( '#ipag_credito_card_type_icon' ).attr('src',imgpath);
                        jQuery( '#ipag_credito_card_type' ).val(brand.type);
                        var cvv = document.getElementById('ipag_credito_card_cvv');
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
                    jQuery( '#ipag_credito_card_type_icon' ).attr('src','');
                    jQuery( '#ipag_credito_card_type' ).val('');
                }
            });
        });

        jQuery( 'form.checkout' ).on( 'checkout_place_order_ipag-gateway', function(e) {
            var savedCardsInput = jQuery('#ipag_saved_card_option_cards');

            if (savedCardsInput.length && savedCardsInput.prop('checked')) {
                return iPagFormValidator('', ipag_test, false);
            }

            return iPagFormValidator('credito', ipag_test, false);
        });

        jQuery( 'form#order_review' ).submit( function(e) {
            return iPagFormValidator('', ipag_test, false);
        });
    </script>