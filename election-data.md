Quero integrar diretamente as fontes oficiais do TSE ao mapa eleitoral de Salvador, utilizando os dados das Eleições Municipais de 2024.



\*\*1. Candidaturas\*\*

\- Consultar o DivulgaCandContas para obter os candidatos de Salvador em 2024.

\- Obter nome, nome de urna, número, partido, cargo, situação da candidatura e identificador `sqcand`.

\- Não quero cadastrar ou categorizar candidatos manualmente.



API REST utilizada pelo DivulgaCandContas:

https://divulgacandcontas.tse.jus.br/divulga/rest/v1



A documentação disponível é uma referência não oficial:

https://meucandidato.github.io/tse-apidoc/



\*\*2. Fotografias\*\*

\- Utilizar o identificador `sqcand` para montar as URLs das fotografias oficiais.

\- Consultar a documentação do TSE para identificar corretamente a estrutura de diretórios.

\- Exibir as fotos diretamente, sem exigir download e organização manual.



\*\*3. Resultados eleitorais\*\*

Utilizar os arquivos JSON oficiais de divulgação dos resultados de 2024:



https://resultados.tse.jus.br/oficial/



Documentação oficial:

https://www.tse.jus.br/eleicoes/informacoes-tecnicas-sobre-a-divulgacao-de-resultados-2024



Buscar os resultados de Salvador, incluindo votação nominal por candidato, cargo, zona eleitoral e seção eleitoral, além de comparecimento, abstenção, votos brancos e nulos.



\*\*4. Integração geográfica\*\*

\- Cruzar os resultados com os locais de votação e suas informações geográficas.

\- Não presumir que uma seção eleitoral equivale a um bairro.

\- Manter os polígonos oficiais dos bairros de Salvador como base cartográfica.

\- Deixar explícito quando não houver informação suficiente para atribuir votos a um bairro com precisão.



\*\*5. Automação\*\*

Quero que a obtenção, atualização, associação e organização dos dados sejam automatizadas. Não quero precisar baixar arquivos manualmente, renomear fotos, cadastrar candidatos ou categorizar partidos um por um.



Priorize fontes oficiais do TSE. Antes de implementar, teste os endpoints, confirme os formatos e documente quais informações realmente estão disponíveis.

