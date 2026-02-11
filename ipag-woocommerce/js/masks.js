 function mask(o,f){
     if(f != empty)
     {
        v_obj=o;
        v_fun=f;
        setTimeout("execmascara()",1)
     }
    }
    
    /*Função que Executa os objetos*/
    function execmascara(){
        v_obj.value=v_fun(v_obj.value)
    }
    
    /*Função que Determina as expressões regulares dos objetos*/
    function leech(v){
        v=v.replace(/o/gi,"0")
        v=v.replace(/i/gi,"1")
        v=v.replace(/z/gi,"2")
        v=v.replace(/e/gi,"3")
        v=v.replace(/a/gi,"4")
        v=v.replace(/s/gi,"5")
        v=v.replace(/t/gi,"7")
        return v
    }
    
    function empty(v){
    	return v;
    }

    /*Função que permite apenas caracteres sem acentos*/
    function maskSimpleChars(v){
        v = v.replace(/[^a-zA-Z]+/,"")
        v = retirarAcento(v)
        v = trim(v)
        return v
    }

    function maskUpperSimpleChars(v){
        v = v.replace(/[^a-zA-Z]+/,"")
        v = retirarAcento(v)
        v = trim(v)
        v = v.toUpperCase();
        return v
    }

    function maskLowerSimpleChars(v){
        v = v.replace(/[^a-zA-Z]+/,"")
        v = retirarAcento(v)
        v = trim(v)
        v = v.toLowerCase();
        return v
    }

    /*Função que permite apenas numeros*/
    function maskNumber(v){
        return v.replace(/\D/g,"")
    }
    
    /*Função que padroniza telefone (11) 4184-1241*/
    function maskPhone(v){
        //v=v.replace(/\D/g,"")                 
        //v=v.replace(/^(\d\d)(\d)/g,"($1) $2") 
        //v=v.replace(/(\d{4})(\d)/,"$1-$2")
        
        
        v=v.replace(/\D/g,"");             //Remove tudo o que não é dígito
        v=v.replace(/^(\d{2})(\d)/g,"($1) $2"); //Coloca parênteses em volta dos dois primeiros dígitos
        v=v.replace(/(\d)(\d{4})$/,"$1-$2");    //Coloca hífen entre o quarto e o quinto dígitos
        
        v = v.substr(0,15)
        return v;
    }
    
    /*Função que padroniza telefone 111.111.111-00*/
    function maskCpf(v){
        v=v.replace(/\D/g,"")                   
        v=v.replace(/^(\d{3})(\d)/,"$1.$2")     
        v=v.replace(/^(\d{3})(\d{3})(\d)/,"$1.$2.$3") 
        v=v.replace(/(\d{11})(\d)/,"$1-$2")
        v = v.substr(0,14)
        return v
    }

    /*Função que padroniza telefone (11) 41841241*/
    function maskPhonecall(v){
        v=v.replace(/\D/g,"")                 
        v=v.replace(/^(\d\d)(\d)/g,"($1) $2")    
        return v
    }
    
    /*Função que padroniza CPF*/
    function maskCpf(v){
        v=v.replace(/\D/g,"")                    
        v=v.replace(/(\d{3})(\d)/,"$1.$2")       
        v=v.replace(/(\d{3})(\d)/,"$1.$2")       
                                                 
        v=v.replace(/(\d{3})(\d)/,"$1-$2")
        v = v.substr(0,14)
        return v
    }
    
    /*Função que padroniza CEP*/
    function maskCep(v){
        v=v.replace(/\D/g,"") 
        v=v.replace(/^(\d{5})(\d)/,"$1-$2")
        v = v.substr(0,9)
        return v
    }
    
    /*Função que padroniza CNPJ*/
    function maskCnpj(v){
        v=v.replace(/\D/g,"")                   
        v=v.replace(/^(\d{2})(\d)/,"$1.$2")     
        v=v.replace(/^(\d{2})\.(\d{3})(\d)/,"$1.$2.$3") 
        v=v.replace(/\.(\d{3})(\d)/,".$1/$2")           
        v=v.replace(/(\d{4})(\d)/,"$1-$2")
        v = v.substr(0,18)
        return v
    }
    
    /*Função que permite apenas numeros Romanos*/
    function maskRoman(v){
        v=v.toUpperCase()             
        v=v.replace(/[^IVXLCDM]/g,"") 
        
        while(v.replace(/^M{0,4}(CM|CD|D?C{0,3})(XC|XL|L?X{0,3})(IX|IV|V?I{0,3})$/,"")!="")
            v=v.replace(/.$/,"")
        return v
    }
    
    /*Função que padroniza o Site*/
    function maskSite(v){
        v=v.replace(/^http:\/\/?/,"")
        dominio=v
        caminho=""
        if(v.indexOf("/")>-1)
            dominio=v.split("/")[0]
            caminho=v.replace(/[^\/]*/,"")
            dominio=dominio.replace(/[^\w\.\+-:@]/g,"")
            caminho=caminho.replace(/[^\w\d\+-@:\?&=%\(\)\.]/g,"")
            caminho=caminho.replace(/([\?&])=/,"$1")
        if(caminho!="")dominio=dominio.replace(/\.+$/,"")
            v="http://"+dominio+caminho
        return v
    }

    function maskTimestamp(v){
        v=v.replace(/D/g,"");
          v=v.replace(/^(\d{2})(\d)/,"$1/$2")
          v=v.replace(/^(\d{2}\057\d{2})(\d)/,"$1/$2")
          v=v.replace(/(\d{4})(\d)/,"$1 $2")
          v=v.replace(/( \d{2})(\d)/,"$1:$2")
          v=v.replace(/(\d{2}:\d{2})(\d)/,"$1:$2")
        v = v.substr(0,19)
        return v
    }

    /*Função que padroniza DATA*/

    function maskDate(v){
        v=v.replace(/\D/g,"") 
        v=v.replace(/(\d{2})(\d)/,"$1/$2") 
        v=v.replace(/(\d{2})(\d)/,"$1/$2")
        v = v.substr(0,10)
        return v
    }
    
    /*Função que padroniza DATA*/
    function maskTime(v){
        v=v.replace(/\D/g,"") 
        v=v.replace(/(\d{2})(\d)/,"$1:$2")  
        v=v.replace(/(\d{2})(\d)/,"$1:$2")
        v = v.substr(0,8)
        return v
    }
    
    /*Função que padroniza valor monétario*/
    function maskMoney(v){
        v=v.replace(/\D/g,"") //Remove tudo o que não é dígito
        v=v.replace(/^([0-9]{3}\.?){3}-[0-9]{2}$/,"$1.$2");
        //v=v.replace(/(\d{3})(\d)/g,"$1,$2")
        v=v.replace(/(\d)(\d{2})$/,"$1.$2") //Coloca ponto antes dos 2 últimos digitos
        return v
    }

    function maskDecimal(v){
        v=v.replace(/\D/g,"") //Remove tudo o que não é dígito
        v=v.replace(/^([0-9]{3}\.?){3}-[0-9]{2}$/,"$1.$2");
        //v=v.replace(/(\d{3})(\d)/g,"$1,$2")
        v=v.replace(/(\d)(\d{3})$/,"$1.$2") //Coloca ponto antes dos 2 últimos digitos
        return v
    }
    
    /*Função que padroniza Area*/
    function maskArea(v){
        v=v.replace(/\D/g,"") 
        v=v.replace(/(\d)(\d{2})$/,"$1.$2") 
        return v
        
    }
